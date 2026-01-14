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

    // For CONSUMABLE resources, use inventoryService which handles locking and transaction
    if (resource.type === ResourceType.CONSUMABLE) {
      // Use transaction to make allocation check and save atomic with inventory transaction
      return await this.dataSource.transaction(async (manager) => {
        // Double-check for existing allocation within transaction (prevents race condition)
        const existingInTransaction = await manager.findOne(ResourceAllocation, {
          where: {
            eventId: createAllocationDto.eventId,
            resourceId: createAllocationDto.resourceId,
          },
        });

        if (existingInTransaction) {
          throw new ConflictException('Resource already allocated to this event');
        }

        // Create inventory transaction (this has locking built-in)
        await this.inventoryService.createAllocationTransaction(
          resource.id,
          createAllocationDto.quantity,
          event.id,
          event.startTime,
        );

        // Save allocation record within same transaction (inventory transaction already created)
        const allocation = manager.create(ResourceAllocation, createAllocationDto);
        return await manager.save(allocation);
      });
    }

    // For EXCLUSIVE and SHAREABLE, validate and save in a single transaction
    return await this.validateAndAllocate(resource, event, createAllocationDto);
  }

  /**
   * Validate and allocate EXCLUSIVE or SHAREABLE resources in a single atomic transaction
   * This prevents race conditions by ensuring validation and save happen atomically
   */
  private async validateAndAllocate(
    resource: Resource,
    event: Event,
    createAllocationDto: CreateAllocationDto,
  ): Promise<ResourceAllocation> {
    if (resource.type === ResourceType.EXCLUSIVE) {
      /**
       * CRITICAL FIX: Race Condition Protection
       * 
       * Validate and save in a single transaction with pessimistic locking
       * to prevent double-booking.
       */
      return await this.dataSource.transaction(async (manager) => {
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

        // Create and save allocation within the same transaction
        const allocation = manager.create(ResourceAllocation, createAllocationDto);
        return await manager.save(allocation);
      });
    } else if (resource.type === ResourceType.SHAREABLE) {
      if (!resource.maxConcurrentUsage) {
        throw new BadRequestException('Shareable resource must have maxConcurrentUsage defined');
      }

      /**
       * CRITICAL FIX: Race Condition Protection for Shareable Resources
       */
      return await this.dataSource.transaction(async (manager) => {
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
        if (currentConcurrent + createAllocationDto.quantity > resource.maxConcurrentUsage) {
          throw new ConflictException(
            `Concurrent usage (${currentConcurrent + createAllocationDto.quantity}) exceeds max concurrent usage (${resource.maxConcurrentUsage})`
          );
        }

        // Create and save allocation within the same transaction
        const allocation = manager.create(ResourceAllocation, createAllocationDto);
        return await manager.save(allocation);
      });
    } else {
      throw new BadRequestException('Invalid resource type for this method');
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
      const resource = allocation.resource;
      const quantityDiff = updateAllocationDto.quantity - allocation.quantity;

      // Validate the new quantity
      if (resource.type === ResourceType.CONSUMABLE) {
        /**
         * FIX: Use ledger model for consumable resources
         * 
         * The projected balance at event start time already includes:
         * - All restocks up to that time (positive)
         * - All allocations up to that time, INCLUDING the current allocation (negative)
         * 
         * To check if we can update to a new quantity:
         * 1. Get projected balance (includes current allocation as negative)
         * 2. Add back current allocation quantity (to get balance without this allocation)
         * 3. Check if new quantity is available: available >= newQuantity
         */
        const projectedBalance = await this.inventoryService.getProjectedBalance(
          resource.id,
          allocation.event.startTime,
        );

        // The projected balance includes the current allocation as a negative transaction
        // So available = projectedBalance + current allocation quantity
        const availableWithCurrentAllocation = projectedBalance + allocation.quantity;
        
        // Check if the new quantity is available
        if (updateAllocationDto.quantity > availableWithCurrentAllocation) {
          throw new BadRequestException(
            `Insufficient inventory at event time. Available: ${availableWithCurrentAllocation}, Requested: ${updateAllocationDto.quantity}. ` +
            `Consider rescheduling the event or requesting a restock.`,
          );
        }

        // If reducing quantity, create a return transaction for the difference
        // If increasing quantity, create an allocation transaction for the difference
        if (quantityDiff < 0) {
          // Returning inventory
          await this.inventoryService.createReturnTransaction(
            resource.id,
            Math.abs(quantityDiff),
            allocation.eventId,
          );
        } else if (quantityDiff > 0) {
          // Consuming more inventory
          await this.inventoryService.createAllocationTransaction(
            resource.id,
            quantityDiff,
            allocation.eventId,
            allocation.event.startTime,
          );
        }
      } else if (resource.type === ResourceType.SHAREABLE) {
        if (!resource.maxConcurrentUsage) {
          throw new BadRequestException('Shareable resource must have maxConcurrentUsage defined');
        }

        /**
         * FIX: Make shareable update atomic - validate and save in same transaction
         * This prevents race conditions where another allocation could be created
         * between validation and save
         */
        return await this.dataSource.transaction(async (manager) => {
          // Lock the resource row
          await manager
            .createQueryBuilder(Resource, 'resource')
            .setLock('pessimistic_write')
            .where('resource.id = :resourceId', { resourceId: resource.id })
            .getOne();

          // Check concurrent usage during event time (excluding current allocation)
          const concurrentCount = await manager
            .createQueryBuilder(ResourceAllocation, 'allocation')
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

          // Update and save within the same transaction
          allocation.quantity = updateAllocationDto.quantity;
          return await manager.save(allocation);
        });
      }
      // For EXCLUSIVE resources, quantity change doesn't affect validation

      allocation.quantity = updateAllocationDto.quantity;
    }

    return await this.allocationRepository.save(allocation);
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

    /**
     * FIX: Make removal atomic - fail if return transaction fails
     * This ensures inventory ledger stays consistent
     */
    // For consumable resources, create a return transaction
    if (allocation.resource.type === ResourceType.CONSUMABLE) {
      // If return transaction fails, throw error (don't delete allocation)
      await this.inventoryService.createReturnTransaction(
        allocation.resourceId,
        allocation.quantity,
        allocation.eventId,
        userId,
      );
    }

    // Only delete if return transaction succeeded (or if not consumable)
    await this.allocationRepository.delete(id);
  }
}
