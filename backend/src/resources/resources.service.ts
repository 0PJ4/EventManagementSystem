import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Resource, ResourceType } from '../entities/resource.entity';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { ResourceAllocation } from '../entities/resource-allocation.entity';
import { InventoryService } from '../services/inventory.service';

@Injectable()
export class ResourcesService {
  constructor(
    @InjectRepository(Resource)
    private resourceRepository: Repository<Resource>,
    @InjectRepository(ResourceAllocation)
    private allocationRepository: Repository<ResourceAllocation>,
    @Inject(forwardRef(() => InventoryService))
    private inventoryService: InventoryService,
  ) {}

  async create(createResourceDto: CreateResourceDto): Promise<Resource> {
    const resource = this.resourceRepository.create(createResourceDto);
    
    // For consumable resources, initialize cachedCurrentStock to match availableQuantity
    // This ensures the ledger system starts with the correct initial balance
    if (createResourceDto.type === ResourceType.CONSUMABLE && createResourceDto.availableQuantity !== undefined) {
      resource.cachedCurrentStock = createResourceDto.availableQuantity;
    }
    
    return await this.resourceRepository.save(resource);
  }

  async findAll(organizationId?: string, isGlobal?: boolean, search?: string): Promise<Resource[]> {
    const hasSearch = search && search.trim();
    const searchTerm = hasSearch ? search.trim() : '';
    let resources: Resource[];
    
    // If organizationId is provided, return org-specific resources + global resources
    if (organizationId) {
      const queryBuilder = this.resourceRepository
        .createQueryBuilder('resource')
        .leftJoinAndSelect('resource.organization', 'organization')
        .leftJoinAndSelect('resource.allocations', 'allocations')
        .leftJoinAndSelect('allocations.event', 'event')
        .where('resource.organizationId = :organizationId', { organizationId })
        .orWhere('resource.isGlobal = :isGlobal', { isGlobal: true });
      
      if (hasSearch) {
        queryBuilder.andWhere('(resource.name ILIKE :search OR resource.type::text ILIKE :search)', { search: `%${searchTerm}%` });
      }
      
      resources = await queryBuilder.orderBy('resource.name', 'ASC').getMany();
    } else if (isGlobal !== undefined) {
      // If isGlobal filter is explicitly provided, use it
      if (hasSearch) {
        resources = await this.resourceRepository
          .createQueryBuilder('resource')
          .leftJoinAndSelect('resource.organization', 'organization')
          .leftJoinAndSelect('resource.allocations', 'allocations')
          .leftJoinAndSelect('allocations.event', 'event')
          .where('resource.isGlobal = :isGlobal', { isGlobal })
          .andWhere('(resource.name ILIKE :search OR resource.type::text ILIKE :search)', { search: `%${searchTerm}%` })
          .orderBy('resource.name', 'ASC')
          .getMany();
      } else {
        resources = await this.resourceRepository.find({ 
          where: { isGlobal }, 
          relations: ['organization', 'allocations', 'allocations.event'] 
        });
      }
    } else {
      // No filters: return all resources
      if (hasSearch) {
        resources = await this.resourceRepository
          .createQueryBuilder('resource')
          .leftJoinAndSelect('resource.organization', 'organization')
          .leftJoinAndSelect('resource.allocations', 'allocations')
          .leftJoinAndSelect('allocations.event', 'event')
          .where('(resource.name ILIKE :search OR resource.type::text ILIKE :search)', { search: `%${searchTerm}%` })
          .orderBy('resource.name', 'ASC')
          .getMany();
      } else {
        resources = await this.resourceRepository.find({ 
          relations: ['organization', 'allocations', 'allocations.event'] 
        });
      }
    }

    // For consumable resources, calculate current stock from inventory transactions
    // This ensures accuracy even if cachedCurrentStock is out of sync
    const resourcesWithStock = await Promise.all(
      resources.map(async (resource) => {
        if (resource.type === ResourceType.CONSUMABLE) {
          const currentStock = await this.inventoryService.getCurrentBalance(resource.id);
          return {
            ...resource,
            availableQuantity: currentStock,
          };
        }
        return resource;
      })
    );
    return resourcesWithStock;
  }

  async findAllForOrgAdmin(organizationId: string, search?: string): Promise<Resource[]> {
    // Return org-specific resources + global resources
    const queryBuilder = this.resourceRepository
      .createQueryBuilder('resource')
      .leftJoinAndSelect('resource.organization', 'organization')
      .leftJoinAndSelect('resource.allocations', 'allocations')
      .leftJoinAndSelect('allocations.event', 'event')
      .where('resource.organizationId = :organizationId', { organizationId })
      .orWhere('resource.isGlobal = :isGlobal', { isGlobal: true });
    
    if (search && search.trim()) {
      queryBuilder.andWhere('(resource.name ILIKE :search OR resource.type::text ILIKE :search)', { search: `%${search.trim()}%` });
    }
    
    const resources = await queryBuilder.orderBy('resource.name', 'ASC').getMany();

    // For consumable resources, calculate current stock from inventory transactions
    // This ensures accuracy even if cachedCurrentStock is out of sync
    const resourcesWithStock = await Promise.all(
      resources.map(async (resource) => {
        if (resource.type === ResourceType.CONSUMABLE) {
          const currentStock = await this.inventoryService.getCurrentBalance(resource.id);
          return {
            ...resource,
            availableQuantity: currentStock,
          };
        }
        return resource;
      })
    );
    return resourcesWithStock;
  }

  async findOne(id: string): Promise<Resource> {
    const resource = await this.resourceRepository.findOne({
      where: { id },
      relations: ['organization', 'allocations'],
    });
    if (!resource) {
      throw new NotFoundException(`Resource with ID ${id} not found`);
    }

    // For consumable resources, calculate current stock from inventory transactions
    // This ensures accuracy even if cachedCurrentStock is out of sync
    if (resource.type === ResourceType.CONSUMABLE) {
      const currentStock = await this.inventoryService.getCurrentBalance(id);
      return {
        ...resource,
        availableQuantity: currentStock,
      };
    }
    return resource;
  }

  async update(id: string, updateResourceDto: UpdateResourceDto, userId?: string, isAdmin: boolean = false, isOrgAdmin: boolean = false): Promise<Resource> {
    const existingResource = await this.resourceRepository.findOne({ where: { id }, select: ['id', 'type', 'availableQuantity', 'cachedCurrentStock', 'organizationId'] });
    
    if (!existingResource) {
      throw new NotFoundException(`Resource with ID ${id} not found`);
    }

    // Handle consumable resource quantity updates
    if (existingResource.type === ResourceType.CONSUMABLE && 'availableQuantity' in updateResourceDto) {
      const newQuantity = updateResourceDto.availableQuantity!;
      
      // Only admins (master or org) can directly update consumable quantities
      // Org admins can only update resources from their organization (checked in controller)
      if (!isAdmin && !isOrgAdmin) {
        throw new BadRequestException(
          'Cannot directly update availableQuantity for consumable resources. ' +
          'Use the /inventory/restock endpoint to add inventory through the ledger system. ' +
          'Only administrators can adjust quantities directly.'
        );
      }

      // Admin/Org Admin is updating quantity - create an adjustment transaction to maintain ledger integrity
      const currentQuantity = existingResource.cachedCurrentStock ?? existingResource.availableQuantity;
      
      // Create adjustment transaction
      const adminType = isAdmin ? 'Admin' : 'Org Admin';
      await this.inventoryService.createAdjustmentTransaction(
        id,
        newQuantity,
        currentQuantity,
        `${adminType} quantity adjustment via resource update`,
        userId,
      );

      // Remove availableQuantity from update DTO since we've handled it via adjustment
      const { availableQuantity, ...rest } = updateResourceDto;
      updateResourceDto = rest as UpdateResourceDto;
    }

    // Update other fields (name, description, etc.) or quantity for non-consumables
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
    let availableQuantity: number;
    let totalQuantity: number;
    let currentConcurrentUsage = 0;

    if (resource.type === ResourceType.EXCLUSIVE) {
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
      totalQuantity = resource.availableQuantity;
      availableQuantity = conflicts.length > 0 ? 0 : resource.availableQuantity;
      currentConcurrentUsage = conflicts.length > 0 ? 1 : 0;
    } else if (resource.type === ResourceType.CONSUMABLE) {
      /**
       * FIX: Use current stock for display, not time-based projection
       * 
       * For consumable resources, the available quantity should be the CURRENT stock,
       * which only changes when restocking or direct quantity adjustment.
       * This ensures consistency across all events for the same resource.
       * 
       * Note: Validation logic (in allocations service) still uses projected balance
       * to check if allocation is valid at event start time, but display uses current stock.
       */
      // Get current stock (cachedCurrentStock is the source of truth)
      const currentStock = await this.inventoryService.getCurrentBalance(resource.id);

      // Calculate total allocated quantity for overlapping events (for display/conflicts)
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

      // Available quantity = current stock (consistent across all events)
      // This only changes when restocking or direct quantity adjustment
      totalQuantity = currentStock;
      availableQuantity = Math.max(0, currentStock);
      currentConcurrentUsage = allocatedQuantity;
    } else if (resource.type === ResourceType.SHAREABLE) {
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
      totalQuantity = maxConcurrent;
      availableQuantity = Math.max(0, maxConcurrent - currentConcurrentUsage);
      allocatedQuantity = currentConcurrentUsage;
    } else {
      // Fallback (shouldn't happen)
      totalQuantity = resource.availableQuantity;
      availableQuantity = resource.availableQuantity;
    }

    return {
      available: availableQuantity > 0,
      availableQuantity,
      conflicts,
      availabilityDetails: {
        totalQuantity,
        allocatedQuantity,
        remainingQuantity: availableQuantity,
        maxConcurrentUsage: resource.maxConcurrentUsage || undefined,
        currentConcurrentUsage,
        remainingConcurrentCapacity:
          resource.type === ResourceType.SHAREABLE
            ? (resource.maxConcurrentUsage || resource.availableQuantity) - currentConcurrentUsage
            : undefined,
      },
    };
  }
}
