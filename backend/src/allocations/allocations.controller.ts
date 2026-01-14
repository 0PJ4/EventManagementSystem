import { Controller, Get, Post, Body, Param, Delete, Patch, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { AllocationsService } from './allocations.service';
import { CreateAllocationDto } from './dto/create-allocation.dto';
import { UpdateAllocationDto } from './dto/update-allocation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResourceAllocation } from '../entities/resource-allocation.entity';

@Controller('allocations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.ORG)
export class AllocationsController {
  constructor(
    private readonly allocationsService: AllocationsService,
    @InjectRepository(ResourceAllocation)
    private allocationRepository: Repository<ResourceAllocation>,
  ) {}

  @Post()
  allocate(@Body() createAllocationDto: CreateAllocationDto) {
    return this.allocationsService.allocate(createAllocationDto);
  }

  @Get()
  findAll(
    @Query('eventId') eventId?: string,
    @Query('resourceId') resourceId?: string,
    @Query('search') search?: string,
  ) {
    return this.allocationsService.findAll(eventId, resourceId, search);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateAllocationDto: UpdateAllocationDto, @Request() req) {
    // Org admins cannot edit allocations for past events
    if (req.user.role === UserRole.ORG) {
      const allocation = await this.allocationRepository.findOne({
        where: { id },
        relations: ['event'],
      });
      if (!allocation) {
        throw new BadRequestException('Allocation not found');
      }
      if (allocation.event) {
        const now = new Date();
        if (new Date(allocation.event.endTime) < now) {
          throw new BadRequestException('Cannot edit allocations for past events');
        }
      }
    }
    return this.allocationsService.update(id, updateAllocationDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req) {
    // Org admins cannot delete allocations for past events
    if (req.user.role === UserRole.ORG) {
      const allocation = await this.allocationRepository.findOne({
        where: { id },
        relations: ['event'],
      });
      if (!allocation) {
        throw new BadRequestException('Allocation not found');
      }
      if (allocation.event) {
        const now = new Date();
        if (new Date(allocation.event.endTime) < now) {
          throw new BadRequestException('Cannot delete allocations for past events');
        }
      }
    }
    return this.allocationsService.remove(id, req.user?.id);
  }
}
