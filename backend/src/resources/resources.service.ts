import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Resource } from '../entities/resource.entity';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { ResourceAllocation } from '../entities/resource-allocation.entity';

@Injectable()
export class ResourcesService {
  constructor(
    @InjectRepository(Resource)
    private resourceRepository: Repository<Resource>,
    @InjectRepository(ResourceAllocation)
    private allocationRepository: Repository<ResourceAllocation>,
  ) {}

  async create(createResourceDto: CreateResourceDto): Promise<Resource> {
    const resource = this.resourceRepository.create(createResourceDto);
    return this.resourceRepository.save(resource);
  }

  async findAll(organizationId?: string, isGlobal?: boolean): Promise<Resource[]> {
    const where: any = {};
    if (organizationId) {
      where.organizationId = organizationId;
    }
    if (isGlobal !== undefined) {
      where.isGlobal = isGlobal;
    }
    return this.resourceRepository.find({ 
      where, 
      relations: ['organization', 'allocations', 'allocations.event'] 
    });
  }

  async findAllForOrgAdmin(organizationId: string): Promise<Resource[]> {
    // Return org-specific resources + global resources
    const resources = await this.resourceRepository
      .createQueryBuilder('resource')
      .leftJoinAndSelect('resource.organization', 'organization')
      .leftJoinAndSelect('resource.allocations', 'allocations')
      .leftJoinAndSelect('allocations.event', 'event')
      .where('resource.organizationId = :organizationId', { organizationId })
      .orWhere('resource.isGlobal = :isGlobal', { isGlobal: true })
      .orderBy('resource.name', 'ASC')
      .getMany();
    
    return resources;
  }

  async findOne(id: string): Promise<Resource> {
    const resource = await this.resourceRepository.findOne({
      where: { id },
      relations: ['organization', 'allocations'],
    });
    if (!resource) {
      throw new NotFoundException(`Resource with ID ${id} not found`);
    }
    return resource;
  }

  async update(id: string, updateResourceDto: UpdateResourceDto): Promise<Resource> {
    await this.resourceRepository.update(id, updateResourceDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.resourceRepository.delete(id);
  }

  async getAvailability(
    resourceId: string,
    startTime: Date,
    endTime: Date,
    excludeEventId?: string,
  ): Promise<{
    available: boolean;
    availableQuantity: number;
    conflicts: Array<{
      eventId: string;
      eventTitle: string;
      startTime: Date;
      endTime: Date;
      allocatedQuantity: number;
    }>;
    availabilityDetails: {
      totalQuantity: number;
      allocatedQuantity: number;
      remainingQuantity: number;
      maxConcurrentUsage?: number;
      currentConcurrentUsage: number;
      remainingConcurrentCapacity?: number;
    };
  }> {
    const resource = await this.resourceRepository.findOne({
      where: { id: resourceId },
      relations: ['allocations', 'allocations.event'],
    });

    if (!resource) {
      throw new NotFoundException(`Resource with ID ${resourceId} not found`);
    }

    // Find all overlapping allocations, excluding the current event if provided
    const overlappingAllocations = resource.allocations?.filter((allocation) => {
      // Exclude the current event from conflicts
      if (excludeEventId && allocation.event.id === excludeEventId) {
        return false;
      }
      const allocStart = new Date(allocation.event.startTime);
      const allocEnd = new Date(allocation.event.endTime);
      // Check if time ranges overlap
      return allocStart < endTime && allocEnd > startTime;
    }) || [];

    // Calculate conflicts and availability based on resource type
    const conflicts: Array<{
      eventId: string;
      eventTitle: string;
      startTime: Date;
      endTime: Date;
      allocatedQuantity: number;
    }> = [];

    let allocatedQuantity = 0;
    let availableQuantity = resource.availableQuantity;
    let currentConcurrentUsage = 0;

    if (resource.type === 'exclusive') {
      // Exclusive: any overlap means 0 available
      for (const allocation of overlappingAllocations) {
        conflicts.push({
          eventId: allocation.event.id,
          eventTitle: allocation.event.title,
          startTime: new Date(allocation.event.startTime),
          endTime: new Date(allocation.event.endTime),
          allocatedQuantity: allocation.quantity,
        });
        allocatedQuantity += allocation.quantity;
      }
      availableQuantity = conflicts.length > 0 ? 0 : resource.availableQuantity;
      currentConcurrentUsage = conflicts.length > 0 ? 1 : 0;
    } else if (resource.type === 'consumable') {
      // Consumable: subtract allocated quantities
      for (const allocation of overlappingAllocations) {
        allocatedQuantity += allocation.quantity;
        conflicts.push({
          eventId: allocation.event.id,
          eventTitle: allocation.event.title,
          startTime: new Date(allocation.event.startTime),
          endTime: new Date(allocation.event.endTime),
          allocatedQuantity: allocation.quantity,
        });
      }
      availableQuantity = Math.max(0, resource.availableQuantity - allocatedQuantity);
      currentConcurrentUsage = allocatedQuantity;
    } else if (resource.type === 'shareable') {
      // Shareable: check against maxConcurrentUsage
      for (const allocation of overlappingAllocations) {
        currentConcurrentUsage += allocation.quantity;
        conflicts.push({
          eventId: allocation.event.id,
          eventTitle: allocation.event.title,
          startTime: new Date(allocation.event.startTime),
          endTime: new Date(allocation.event.endTime),
          allocatedQuantity: allocation.quantity,
        });
      }
      const maxConcurrent = resource.maxConcurrentUsage || resource.availableQuantity;
      availableQuantity = Math.max(0, maxConcurrent - currentConcurrentUsage);
      allocatedQuantity = currentConcurrentUsage;
    }

    return {
      available: availableQuantity > 0,
      availableQuantity,
      conflicts,
      availabilityDetails: {
        totalQuantity: resource.availableQuantity,
        allocatedQuantity,
        remainingQuantity: availableQuantity,
        maxConcurrentUsage: resource.maxConcurrentUsage || undefined,
        currentConcurrentUsage,
        remainingConcurrentCapacity:
          resource.type === 'shareable'
            ? (resource.maxConcurrentUsage || resource.availableQuantity) - currentConcurrentUsage
            : undefined,
      },
    };
  }
}
