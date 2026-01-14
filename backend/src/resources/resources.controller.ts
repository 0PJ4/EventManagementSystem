import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ResourcesService } from './resources.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';

@Controller('resources')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.ORG)
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Post()
  create(@Body() createResourceDto: CreateResourceDto, @Request() req) {
    // Org admins can create resources for their organization OR global resources
    if (req.user.role === UserRole.ORG) {
      // If creating a global resource, organizationId must be null
      if (createResourceDto.isGlobal) {
        createResourceDto.organizationId = null;
      } else {
        // If creating org-specific resource, must be for their organization
        if (createResourceDto.organizationId !== req.user.organizationId) {
          throw new ForbiddenException('You can only create resources for your organization');
        }
      }
    }
    return this.resourcesService.create(createResourceDto);
  }

  @Get()
  findAll(
    @Query('organizationId') organizationId?: string,
    @Query('isGlobal') isGlobal?: string,
    @Query('search') search?: string,
    @Request() req?,
  ) {
    // Org admins should see: their own org resources + global resources
    // Admins see: all resources
    if (req.user.role === UserRole.ORG && !organizationId && !isGlobal) {
      // If no specific filter, show org resources + global resources
      return this.resourcesService.findAllForOrgAdmin(req.user.organizationId, search);
    }
    
    return this.resourcesService.findAll(
      organizationId,
      isGlobal === 'true' ? true : isGlobal === 'false' ? false : undefined,
      search,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.resourcesService.findOne(id);
  }

  @Get(':id/availability')
  async getAvailability(
    @Param('id') id: string,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
    @Query('excludeEventId') excludeEventId?: string,
  ) {
    if (!startTime || !endTime) {
      throw new BadRequestException('startTime and endTime query parameters are required');
    }
    return this.resourcesService.getAvailability(id, new Date(startTime), new Date(endTime), excludeEventId);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateResourceDto: UpdateResourceDto, @Request() req) {
    const isAdmin = req.user.role === UserRole.ADMIN;
    const isOrgAdmin = req.user.role === UserRole.ORG;
    
    // Org admins can only update resources from their organization
    if (req.user.role === UserRole.ORG) {
      const resource = await this.resourcesService.findOne(id);
      if (resource.organizationId !== req.user.organizationId) {
        throw new ForbiddenException('You can only update resources from your organization');
      }
    }
    
    return this.resourcesService.update(id, updateResourceDto, req.user.id, isAdmin, isOrgAdmin);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req) {
    // Org admins can only delete resources from their organization
    if (req.user.role === UserRole.ORG) {
      const resource = await this.resourcesService.findOne(id);
      if (resource.organizationId !== req.user.organizationId) {
        throw new ForbiddenException('You can only delete resources from your organization');
      }
    }
    return this.resourcesService.remove(id);
  }
}
