import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request, ForbiddenException, BadRequestException } from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';

@Controller('events')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ORG)
  create(@Body() createEventDto: CreateEventDto) {
    return this.eventsService.create(createEventDto);
  }

  @Get()
  findAll(
    @Query('organizationId') organizationId?: string,
    @Query('search') search?: string,
    @Request() req?,
  ) {
    // Filter events based on user role
    const userRole = req.user.role;
    const userOrgId = req.user.organizationId;
    const userId = req.user.id;
    
    return this.eventsService.findAll(organizationId, userRole, userOrgId, userId, search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.ORG)
  async update(@Param('id') id: string, @Body() updateEventDto: UpdateEventDto, @Request() req) {
    // Org admins can only update their own org's events
    if (req.user.role === UserRole.ORG) {
      const event = await this.eventsService.findOne(id);
      if (event.organizationId !== req.user.organizationId) {
        throw new ForbiddenException('You can only update events from your organization');
      }
      // Org admins cannot edit past events
      const now = new Date();
      if (new Date(event.endTime) < now) {
        throw new BadRequestException('Cannot edit past events');
      }
    }
    return this.eventsService.update(id, updateEventDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.ORG)
  async remove(@Param('id') id: string, @Request() req) {
    // Org admins can only delete their own org's events
    if (req.user.role === UserRole.ORG) {
      const event = await this.eventsService.findOne(id);
      if (event.organizationId !== req.user.organizationId) {
        throw new ForbiddenException('You can only delete events from your organization');
      }
      // Org admins cannot delete past events
      const now = new Date();
      if (new Date(event.endTime) < now) {
        throw new BadRequestException('Cannot delete past events');
      }
    }
    return this.eventsService.remove(id);
  }
}
