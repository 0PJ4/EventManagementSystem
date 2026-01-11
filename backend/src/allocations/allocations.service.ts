import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResourceAllocation } from '../entities/resource-allocation.entity';
import { Resource, ResourceType } from '../entities/resource.entity';
import { Event } from '../entities/event.entity';
import { CreateAllocationDto } from './dto/create-allocation.dto';

@Injectable()
export class AllocationsService {
  constructor(
    @InjectRepository(ResourceAllocation)
    private allocationRepository: Repository<ResourceAllocation>,
    @InjectRepository(Resource)
    private resourceRepository: Repository<Resource>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
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
      // Check available quantity
      if (quantity > resource.availableQuantity) {
        throw new BadRequestException(
          `Requested quantity (${quantity}) exceeds available quantity (${resource.availableQuantity})`
        );
      }

      // Check total allocated quantity for this event
      const totalAllocated = await this.allocationRepository
        .createQueryBuilder('allocation')
        .where('allocation.eventId = :eventId', { eventId: event.id })
        .andWhere('allocation.resourceId = :resourceId', { resourceId: resource.id })
        .select('COALESCE(SUM(allocation.quantity), 0)', 'total')
        .getRawOne();

      const currentAllocated = parseInt(totalAllocated?.total || '0', 10);
      if (currentAllocated + quantity > resource.availableQuantity) {
        throw new BadRequestException('Total allocated quantity exceeds available quantity');
      }
    } else if (resource.type === ResourceType.EXCLUSIVE) {
      // Check for overlapping allocations
      const overlapping = await this.allocationRepository
        .createQueryBuilder('allocation')
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
    } else if (resource.type === ResourceType.SHAREABLE) {
      if (!resource.maxConcurrentUsage) {
        throw new BadRequestException('Shareable resource must have maxConcurrentUsage defined');
      }

      // Count concurrent allocations during event time
      const concurrentCount = await this.allocationRepository
        .createQueryBuilder('allocation')
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
    }
  }

  async findAll(eventId?: string, resourceId?: string): Promise<ResourceAllocation[]> {
    const where: any = {};
    if (eventId) {
      where.eventId = eventId;
    }
    if (resourceId) {
      where.resourceId = resourceId;
    }
    return this.allocationRepository.find({
      where,
      relations: ['event', 'resource'],
      order: { allocatedAt: 'DESC' },
    });
  }

  async remove(id: string): Promise<void> {
    await this.allocationRepository.delete(id);
  }
}
