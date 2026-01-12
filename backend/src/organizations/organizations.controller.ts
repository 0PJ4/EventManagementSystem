import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { UserRole } from '../entities/user.entity';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  // Public endpoint must come before parameterized routes
  @Public()
  @Get('public')
  findAllPublic() {
    return this.organizationsService.findAll();
  }

  // Only admin can create organizations
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() createOrganizationDto: CreateOrganizationDto) {
    return this.organizationsService.create(createOrganizationDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Query('search') search?: string) {
    return this.organizationsService.findAll(search);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.organizationsService.findOne(id);
  }

  // Admin and org admin can update (org admin only their own)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ORG)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateOrganizationDto: UpdateOrganizationDto, @Request() req: any) {
    // If org admin, ensure they can only update their own organization
    if (req.user.role === UserRole.ORG && req.user.organizationId !== id) {
      throw new ForbiddenException('You can only update your own organization');
    }
    return this.organizationsService.update(id, updateOrganizationDto);
  }

  // Only admin can delete organizations
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.organizationsService.remove(id);
  }
}
