import { Injectable, NotFoundException, BadRequestException, ConflictException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, Brackets, DataSource } from 'typeorm';
import { ResourceAllocation } from '../entities/resource-allocation.entity';
import { Resource, ResourceType } from '../entities/resource.entity';
import { Event } from '../entities/event.entity';
import { CreateAllocationDto } from './dto/create-allocation.dto';
import { UpdateAllocationDto } from './dto/update-allocation.dto';
import { InventoryService } from '../services/inventory.service';

@Injectable()
export class AllocationsService {
  constructor(
    @InjectRepository(ResourceAllocation)
    private allocationRepository: Repository<ResourceAllocation>,
    @InjectRepository(Resource)
    private resourceRepository: Repository<Resource>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @Inject(forwardRef(() => InventoryService))
    private inventoryService: InventoryService,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  async allocate(createAllocationDto: CreateAllocationDto): Promise<ResourceAllocation> {
    const resource = await this.resourceRepository.findOne({
      where: { id: createAllocationDto.resourceId },
      relations: ['allocations'],
    });

    if (!resource) {
      throw new NotFoundException(`Resource with ID ${createAllocationDto.resourceId} not found`);
    }

    const event = await this.eventRepository.findOne({
      where: { id: createAllocationDto.eventId },
      relations: ['resourceAllocations'],
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${createAllocationDto.eventId} not found`);
    }

    // Check if already allocated
    const existing = await this.allocationRepository.findOne({
      where: {
        eventId: createAllocationDto.eventId,
        resourceId: createAllocationDto.resourceId,
      },
    });

    if (existing) {
      throw new ConflictException('Resource already allocated to this event');
    }

    // Validate allocation based on resource type
    await this.validateAllocation(resource, event, createAllocationDto.quantity);

    const allocation = this.allocationRepository.create(createAllocationDto);
    return this.allocationRepository.save(allocation);
  }

  private async validateAllocation(
    resource: Resource,
    event: Event,
    quantity: number,
  ): Promise<void> {
    if (resource.type === ResourceType.CONSUMABLE) {
      /**
       * LEDGER MODEL VALIDATION
       * 
       * Instead of checking static availableQuantity, we calculate the
       * projected balance at the event's start time.
       * 
       * This accounts for:
       * - Future restocks before this event
       * - Other events scheduled before this event
       * - Time-based inventory availability
       */
      const projectedBalance = await this.inventoryService.getProjectedBalance(
        resource.id,
        event.startTime,
      );

      if (quantity > projectedBalance) {
        throw new BadRequestException(
          `Insufficient inventory at event time. Projected available: ${projectedBalance}, Requested: ${quantity}. ` +
          `Consider rescheduling the event or requesting a restock.`,
        );
      }

      // Additional check: ensure quantity is positive
      if (quantity <= 0) {
        throw new BadRequestException('Allocation quantity must be positive');
      }
    } else if (resource.type === ResourceType.EXCLUSIVE) {
      /**
       * CRITICAL FIX: Race Condition Protection
       * 
       * Without locking, two concurrent requests can both pass the check
       * and create conflicting allocations (double-booking).
       * 
       * Solution: Use pessimistic write lock to ensure atomicity.
       */
      await this.dataSource.transaction(async (manager) => {
        // Lock the resource row to prevent concurrent allocations
        await manager
          .createQueryBuilder(Resource, 'resource')
          .setLock('pessimistic_write')
          .where('resource.id = :resourceId', { resourceId: resource.id })
          .getOne();

        // Check for overlapping allocations (while holding lock)
        const overlapping = await manager
          .createQueryBuilder(ResourceAllocation, 'allocation')
          .innerJoin('allocation.event', 'event')
          .where('allocation.resourceId = :resourceId', { resourceId: resource.id })
          .andWhere('event.id != :eventId', { eventId: event.id })
          .andWhere(
            '(event.startTime < :endTime AND event.endTime > :startTime)',
            {
              startTime: event.startTime,
              endTime: event.endTime,
            }
          )
          .getMany();

        if (overlapping.length > 0) {
          throw new ConflictException(
            'Exclusive resource is already allocated to an overlapping event'
          );
        }
        
        // Lock is released on transaction commit
      });
    } else if (resource.type === ResourceType.SHAREABLE) {
      if (!resource.maxConcurrentUsage) {
        throw new BadRequestException('Shareable resource must have maxConcurrentUsage defined');
      }

      /**
       * CRITICAL FIX: Race Condition Protection for Shareable Resources
       */
      await this.dataSource.transaction(async (manager) => {
        // Lock the resource row
        await manager
          .createQueryBuilder(Resource, 'resource')
          .setLock('pessimistic_write')
          .where('resource.id = :resourceId', { resourceId: resource.id })
          .getOne();

        // Count concurrent allocations during event time (while holding lock)
        const concurrentCount = await manager
          .createQueryBuilder(ResourceAllocation, 'allocation')
          .innerJoin('allocation.event', 'event')
          .where('allocation.resourceId = :resourceId', { resourceId: resource.id })
          .andWhere(
            '(event.startTime < :endTime AND event.endTime > :startTime)',
            {
              startTime: event.startTime,
              endTime: event.endTime,
            }
          )
          .select('COALESCE(SUM(allocation.quantity), 0)', 'total')
          .getRawOne();

        const currentConcurrent = parseInt(concurrentCount?.total || '0', 10);
        if (currentConcurrent + quantity > resource.maxConcurrentUsage) {
          throw new ConflictException(
            `Concurrent usage (${currentConcurrent + quantity}) exceeds max concurrent usage (${resource.maxConcurrentUsage})`
          );
        }
      });
    }
  }

  async findAll(eventId?: string, resourceId?: string, search?: string): Promise<ResourceAllocation[]> {
    const queryBuilder = this.allocationRepository
      .createQueryBuilder('allocation')
      .leftJoinAndSelect('allocation.event', 'event')
      .leftJoinAndSelect('allocation.resource', 'resource');

    // Apply eventId filter
    if (eventId) {
      queryBuilder.andWhere('allocation.eventId = :eventId', { eventId });
    }

    // Apply resourceId filter
    if (resourceId) {
      queryBuilder.andWhere('allocation.resourceId = :resourceId', { resourceId });
    }

    // Apply search filter (event.title OR resource.name)
    if (search && search.trim()) {
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where('event.title ILIKE :search', { search: `%${search.trim()}%` })
            .orWhere('resource.name ILIKE :search', { search: `%${search.trim()}%` });
        })
      );
    }

    return queryBuilder
      .orderBy('allocation.allocatedAt', 'DESC')
      .getMany();
  }

  async update(id: string, updateAllocationDto: UpdateAllocationDto): Promise<ResourceAllocation> {
    const allocation = await this.allocationRepository.findOne({
      where: { id },
      relations: ['resource', 'event'],
    });

    if (!allocation) {
      throw new NotFoundException(`Allocation with ID ${id} not found`);
    }

    // If quantity is being updated, validate the new quantity
    if (updateAllocationDto.quantity !== undefined && updateAllocationDto.quantity !== allocation.quantity) {
      const resource = await this.resourceRepository.findOne({
        where: { id: allocation.resourceId },
      });

      if (!resource) {
        throw new NotFoundException(`Resource with ID ${allocation.resourceId} not found`);
      }

      // Validate the new quantity (excluding current allocation)
      if (resource.type === ResourceType.CONSUMABLE) {
        if (updateAllocationDto.quantity > resource.availableQuantity) {
          throw new BadRequestException(
            `Requested quantity (${updateAllocationDto.quantity}) exceeds available quantity (${resource.availableQuantity})`
          );
        }
        
        // Check total allocated quantity for this event (excluding current allocation)
        const totalAllocated = await this.allocationRepository
          .createQueryBuilder('allocation')
          .where('allocation.eventId = :eventId', { eventId: allocation.eventId })
          .andWhere('allocation.resourceId = :resourceId', { resourceId: allocation.resourceId })
          .andWhere('allocation.id != :allocationId', { allocationId: allocation.id })
          .select('COALESCE(SUM(allocation.quantity), 0)', 'total')
          .getRawOne();

        const currentAllocated = parseInt(totalAllocated?.total || '0', 10);
        if (currentAllocated + updateAllocationDto.quantity > resource.availableQuantity) {
          throw new BadRequestException('Total allocated quantity exceeds available quantity');
        }
      } else if (resource.type === ResourceType.SHAREABLE) {
        if (!resource.maxConcurrentUsage) {
          throw new BadRequestException('Shareable resource must have maxConcurrentUsage defined');
        }

        // Check concurrent usage during event time (excluding current allocation)
        const concurrentCount = await this.allocationRepository
          .createQueryBuilder('allocation')
          .innerJoin('allocation.event', 'event')
          .where('allocation.resourceId = :resourceId', { resourceId: allocation.resourceId })
          .andWhere('allocation.id != :allocationId', { allocationId: allocation.id })
          .andWhere(
            '(event.startTime < :endTime AND event.endTime > :startTime)',
            {
              startTime: allocation.event.startTime,
              endTime: allocation.event.endTime,
            }
          )
          .select('COALESCE(SUM(allocation.quantity), 0)', 'total')
          .getRawOne();

        const currentConcurrent = parseInt(concurrentCount?.total || '0', 10);
        if (currentConcurrent + updateAllocationDto.quantity > resource.maxConcurrentUsage) {
          throw new ConflictException(
            `Concurrent usage (${currentConcurrent + updateAllocationDto.quantity}) exceeds max concurrent usage (${resource.maxConcurrentUsage})`
          );
        }
      }
      // For EXCLUSIVE resources, quantity change doesn't affect validation

      allocation.quantity = updateAllocationDto.quantity;
    }

    return this.allocationRepository.save(allocation);
  }

  async remove(id: string, userId?: string): Promise<void> {
    // Fetch the allocation with resource info
    const allocation = await this.allocationRepository.findOne({
      where: { id },
      relations: ['resource', 'event'],
    });

    if (!allocation) {
      throw new NotFoundException(`Allocation with ID ${id} not found`);
    }

    // For consumable resources, create a return transaction
    if (allocation.resource.type === ResourceType.CONSUMABLE) {
      try {
        await this.inventoryService.createReturnTransaction(
          allocation.resourceId,
          allocation.quantity,
          allocation.eventId,
          userId,
        );
      } catch (error: any) {
        console.error('Failed to create return transaction:', error);
        // Continue with deletion even if return fails (log for manual review)
      }
    }

    await this.allocationRepository.delete(id);
  }
}
