import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, MoreThan, Or, ILike } from 'typeorm';
import { Event } from '../entities/event.entity';
import { Attendance } from '../entities/attendance.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { UserRole } from '../entities/user.entity';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(Attendance)
    private attendanceRepository: Repository<Attendance>,
  ) {}

  async create(createEventDto: CreateEventDto): Promise<Event> {
    const event = this.eventRepository.create({
      ...createEventDto,
      startTime: new Date(createEventDto.startTime),
      endTime: new Date(createEventDto.endTime),
    });
    
    // Validate parent event if provided
    if (createEventDto.parentEventId) {
      const parentEvent = await this.eventRepository.findOne({
        where: { id: createEventDto.parentEventId },
      });
      
      if (!parentEvent) {
        throw new NotFoundException('Parent event not found');
      }

      // Validate that child event is within parent's time boundaries
      const startTime = new Date(createEventDto.startTime);
      const endTime = new Date(createEventDto.endTime);
      if (startTime < parentEvent.startTime || 
          endTime > parentEvent.endTime) {
        throw new BadRequestException(
          'Child event must be within parent event time boundaries'
        );
      }
    }

    return this.eventRepository.save(event);
  }

  async findAll(organizationId?: string, userRole?: string, userOrgId?: string, userId?: string, search?: string): Promise<Event[]> {
    const hasSearch = search && search.trim();
    const searchTerm = hasSearch ? search.trim() : '';
    
    // Admin can see all events (including drafts)
    if (userRole === UserRole.ADMIN) {
      if (organizationId) {
        if (hasSearch) {
          const events = await this.eventRepository
            .createQueryBuilder('event')
            .leftJoinAndSelect('event.organization', 'organization')
            .leftJoinAndSelect('event.parentEvent', 'parentEvent')
            .leftJoinAndSelect('event.childEvents', 'childEvents')
            .leftJoinAndSelect('event.resourceAllocations', 'resourceAllocations')
            .where('event.organizationId = :organizationId', { organizationId })
            .andWhere('(event.title ILIKE :search OR event.description ILIKE :search)', { search: `%${searchTerm}%` })
            .orderBy('event.startTime', 'ASC')
            .getMany();
          
          events.forEach((event) => {
            (event as any).resourceCount = event.resourceAllocations?.length || 0;
          });
          return events;
        } else {
          const events = await this.eventRepository.find({
            where: { organizationId },
            relations: ['organization', 'parentEvent', 'childEvents', 'resourceAllocations'],
            order: { startTime: 'ASC' },
          });
          events.forEach((event) => {
            (event as any).resourceCount = event.resourceAllocations?.length || 0;
          });
          return events;
        }
      } else {
        if (hasSearch) {
          const events = await this.eventRepository
            .createQueryBuilder('event')
            .leftJoinAndSelect('event.organization', 'organization')
            .leftJoinAndSelect('event.parentEvent', 'parentEvent')
            .leftJoinAndSelect('event.childEvents', 'childEvents')
            .leftJoinAndSelect('event.resourceAllocations', 'resourceAllocations')
            .where('(event.title ILIKE :search OR event.description ILIKE :search)', { search: `%${searchTerm}%` })
            .orderBy('event.startTime', 'ASC')
            .getMany();
          
          events.forEach((event) => {
            (event as any).resourceCount = event.resourceAllocations?.length || 0;
          });
          return events;
        } else {
          const events = await this.eventRepository.find({
            relations: ['organization', 'parentEvent', 'childEvents', 'resourceAllocations'],
            order: { startTime: 'ASC' },
          });
          events.forEach((event) => {
            (event as any).resourceCount = event.resourceAllocations?.length || 0;
          });
          return events;
        }
      }
    }
    // Org admin: own org events (including drafts) OR published events with external attendees
    else if (userRole === UserRole.ORG && userOrgId) {
      // If organizationId filter is provided, return ONLY events from that organization
      if (organizationId) {
        if (hasSearch) {
          const events = await this.eventRepository
            .createQueryBuilder('event')
            .leftJoinAndSelect('event.organization', 'organization')
            .leftJoinAndSelect('event.parentEvent', 'parentEvent')
            .leftJoinAndSelect('event.childEvents', 'childEvents')
            .leftJoinAndSelect('event.resourceAllocations', 'resourceAllocations')
            .where('event.organizationId = :organizationId', { organizationId })
            .andWhere('(event.title ILIKE :search OR event.description ILIKE :search)', { search: `%${searchTerm}%` })
            .orderBy('event.startTime', 'ASC')
            .getMany();
          
          events.forEach((event) => {
            (event as any).resourceCount = event.resourceAllocations?.length || 0;
          });
          return events;
        } else {
          const events = await this.eventRepository.find({
            where: { organizationId },
            relations: ['organization', 'parentEvent', 'childEvents', 'resourceAllocations'],
            order: { startTime: 'ASC' },
          });
          events.forEach((event) => {
            (event as any).resourceCount = event.resourceAllocations?.length || 0;
          });
          return events;
        }
      } else {
        // No filter: return own org events + published external events
        if (hasSearch) {
          const events = await this.eventRepository
            .createQueryBuilder('event')
            .leftJoinAndSelect('event.organization', 'organization')
            .leftJoinAndSelect('event.parentEvent', 'parentEvent')
            .leftJoinAndSelect('event.childEvents', 'childEvents')
            .leftJoinAndSelect('event.resourceAllocations', 'resourceAllocations')
            .where(
              '(event.organizationId = :userOrgId OR (event.allowExternalAttendees = true AND event.status = :published))',
              { userOrgId, published: 'published' }
            )
            .andWhere('(event.title ILIKE :search OR event.description ILIKE :search)', { search: `%${searchTerm}%` })
            .orderBy('event.startTime', 'ASC')
            .getMany();
          
          events.forEach((event) => {
            (event as any).resourceCount = event.resourceAllocations?.length || 0;
          });
          return events;
        } else {
          const whereConditions: any[] = [
            { organizationId: userOrgId },
            { allowExternalAttendees: true, status: 'published' }
          ];
          const events = await this.eventRepository.find({
            where: whereConditions,
            relations: ['organization', 'parentEvent', 'childEvents', 'resourceAllocations'],
            order: { startTime: 'ASC' },
          });
          events.forEach((event) => {
            (event as any).resourceCount = event.resourceAllocations?.length || 0;
          });
          return events;
        }
      }
    } else {
      // Regular users: published events from their org OR published events with external attendees
      if (hasSearch) {
        const queryBuilder = this.eventRepository
          .createQueryBuilder('event')
          .leftJoinAndSelect('event.organization', 'organization')
          .leftJoinAndSelect('event.parentEvent', 'parentEvent')
          .leftJoinAndSelect('event.childEvents', 'childEvents')
          .leftJoinAndSelect('event.resourceAllocations', 'resourceAllocations')
          .where('(event.allowExternalAttendees = true AND event.status = :published)', { published: 'published' });
        
        if (userOrgId) {
          queryBuilder.orWhere('(event.organizationId = :userOrgId AND event.status = :published)', { userOrgId, published: 'published' });
        }
        
        queryBuilder.andWhere('(event.title ILIKE :search OR event.description ILIKE :search)', { search: `%${searchTerm}%` });
        
        const events = await queryBuilder.orderBy('event.startTime', 'ASC').getMany();
        
        events.forEach((event) => {
          (event as any).resourceCount = event.resourceAllocations?.length || 0;
        });
        return events;
      } else {
        const whereConditions: any[] = [];
        if (userOrgId) {
          whereConditions.push({ organizationId: userOrgId, status: 'published' });
        }
        whereConditions.push({ allowExternalAttendees: true, status: 'published' });
        
        const events = await this.eventRepository.find({
          where: whereConditions,
          relations: ['organization', 'parentEvent', 'childEvents', 'resourceAllocations'],
          order: { startTime: 'ASC' },
        });
        events.forEach((event) => {
          (event as any).resourceCount = event.resourceAllocations?.length || 0;
        });
        return events;
      }
    }
  }

  async findOne(id: string): Promise<Event> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['organization', 'parentEvent', 'childEvents', 'attendances', 'resourceAllocations'],
    });
    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }
    return event;
  }

  async update(id: string, updateEventDto: UpdateEventDto): Promise<Event> {
    const event = await this.findOne(id);
    
    const updateData: any = { ...updateEventDto };
    
    if (updateEventDto.startTime || updateEventDto.endTime) {
      const startTime = updateEventDto.startTime 
        ? new Date(updateEventDto.startTime) 
        : event.startTime;
      const endTime = updateEventDto.endTime 
        ? new Date(updateEventDto.endTime) 
        : event.endTime;

      // Check parent event boundaries if this is a child event
      if (event.parentEventId) {
        const parentEvent = await this.eventRepository.findOne({
          where: { id: event.parentEventId },
        });
        if (parentEvent && (startTime < parentEvent.startTime || endTime > parentEvent.endTime)) {
          throw new BadRequestException(
            'Child event must be within parent event time boundaries'
          );
        }
      }

      // Check child events boundaries if this is a parent event
      if (event.childEvents && event.childEvents.length > 0) {
        for (const child of event.childEvents) {
          if (startTime > child.startTime || endTime < child.endTime) {
            throw new BadRequestException(
              'Parent event must fully contain all child events'
            );
          }
        }
      }
      
      // Convert string dates to Date objects for update
      if (updateEventDto.startTime) {
        updateData.startTime = new Date(updateEventDto.startTime);
      }
      if (updateEventDto.endTime) {
        updateData.endTime = new Date(updateEventDto.endTime);
      }
    }

    await this.eventRepository.update(id, updateData);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.eventRepository.delete(id);
  }

  async checkUserDoubleBooking(userId: string, startTime: Date, endTime: Date, currentEventId?: string): Promise<boolean> {
    // Get all overlapping events the user is registered for
    const query = this.attendanceRepository
      .createQueryBuilder('attendance')
      .innerJoin('attendance.event', 'event')
      .where('attendance.userId = :userId', { userId })
      .andWhere(
        '(event.startTime < :endTime AND event.endTime > :startTime)',
        { startTime, endTime }
      );

    if (currentEventId) {
      query.andWhere('event.id != :currentEventId', { currentEventId });
    }

    const overlappingAttendances = await query.getMany();

    if (overlappingAttendances.length === 0) {
      return false; // No overlapping events
    }

    // If we have a current event, check if overlapping events are parent/child related
    if (currentEventId) {
      const currentEvent = await this.eventRepository.findOne({
        where: { id: currentEventId },
        relations: ['parentEvent', 'childEvents'],
      });

      if (currentEvent) {
        // Check if any overlapping event is a parent or child of current event
        for (const attendance of overlappingAttendances) {
          const overlappingEvent = await this.eventRepository.findOne({
            where: { id: attendance.eventId },
            relations: ['parentEvent', 'childEvents'],
          });

          if (overlappingEvent) {
            // Check if overlapping event is parent of current event
            if (currentEvent.parentEventId === overlappingEvent.id) {
              continue; // Allow: overlapping event is parent
            }

            // Check if overlapping event is child of current event
            if (overlappingEvent.parentEventId === currentEvent.id) {
              continue; // Allow: overlapping event is child
            }

            // Not parent-child related, this is a conflict
            return true;
          }
        }

        // All overlapping events are parent-child related
        return false;
      }
    }

    // No current event ID or couldn't verify relationships - treat as conflict
    return overlappingAttendances.length > 0;
  }
}
