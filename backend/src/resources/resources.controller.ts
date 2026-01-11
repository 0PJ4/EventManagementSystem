import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request, ForbiddenException } from '@nestjs/common';
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
    // Org admins can only create resources for their organization
    if (req.user.role === UserRole.ORG && createResourceDto.organizationId !== req.user.organizationId) {
      throw new ForbiddenException('You can only create resources for your organization');
    }
    return this.resourcesService.create(createResourceDto);
  }

  @Get()
  findAll(
    @Query('organizationId') organizationId?: string,
    @Query('isGlobal') isGlobal?: string,
  ) {
    return this.resourcesService.findAll(
      organizationId,
      isGlobal === 'true' ? true : isGlobal === 'false' ? false : undefined,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.resourcesService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateResourceDto: UpdateResourceDto, @Request() req) {
    // Org admins can only update resources from their organization
    if (req.user.role === UserRole.ORG) {
      const resource = await this.resourcesService.findOne(id);
      if (resource.organizationId !== req.user.organizationId) {
        throw new ForbiddenException('You can only update resources from your organization');
      }
    }
    return this.resourcesService.update(id, updateResourceDto);
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
