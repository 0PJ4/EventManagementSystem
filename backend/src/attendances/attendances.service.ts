import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Attendance } from '../entities/attendance.entity';
import { Event } from '../entities/event.entity';
import { User } from '../entities/user.entity';
import { Invite, InviteStatus } from '../entities/invite.entity';
import { EventsService } from '../events/events.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';

@Injectable()
export class AttendancesService {
  constructor(
    @InjectRepository(Attendance)
    private attendanceRepository: Repository<Attendance>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Invite)
    private inviteRepository: Repository<Invite>,
    private eventsService: EventsService,
  ) {}

  async register(createAttendanceDto: CreateAttendanceDto): Promise<Attendance> {
    const event = await this.eventRepository.findOne({
      where: { id: createAttendanceDto.eventId },
      relations: ['attendances'],
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${createAttendanceDto.eventId} not found`);
    }

    // Check capacity
    const currentAttendanceCount = event.attendances?.length || 0;
    if (event.capacity > 0 && currentAttendanceCount >= event.capacity) {
      throw new ConflictException('Event capacity exceeded');
    }

    // If user is registering, validate organization and check for double booking
    if (createAttendanceDto.userId) {
      const user = await this.userRepository.findOne({
        where: { id: createAttendanceDto.userId },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${createAttendanceDto.userId} not found`);
      }

      // Validate user can register for this event:
      // 1. User from same org as event (org-specific events)
      // 2. Event allows external attendees (anyone can register)
      // 3. User has an invite to this event
      
      let canRegister = false;
      
      // Same organization - org members can always register for their org's events
      if (user.organizationId && event.organizationId && user.organizationId === event.organizationId) {
        canRegister = true;
      }
      
      // Event allows external attendees - EVERYONE can register (org users, independent users, other orgs)
      if (event.allowExternalAttendees) {
        canRegister = true;
      }
      
      // Check for invite - invited users can register regardless of org
      const invite = await this.inviteRepository.findOne({
        where: { 
          eventId: event.id, 
          userId: user.id,
          status: In([InviteStatus.PENDING, InviteStatus.ACCEPTED])
        }
      });
      if (invite) {
        canRegister = true;
      }
      
      if (!canRegister) {
        throw new ForbiddenException('You do not have permission to register for this event. This event is org-specific.');
      }

      // Check for double booking (allows overlapping parent-child events)
      const isDoubleBooked = await this.eventsService.checkUserDoubleBooking(
        createAttendanceDto.userId,
        event.startTime,
        event.endTime,
        event.id,
      );

      if (isDoubleBooked) {
        throw new ConflictException('User is already registered for an overlapping event that is not a parent or child event');
      }
    }

    // If external attendee, check if event allows external attendees
    if (!createAttendanceDto.userId && !event.allowExternalAttendees) {
      throw new BadRequestException('Event does not allow external attendees');
    }

    // Check if already registered
    const existing = await this.attendanceRepository.findOne({
      where: createAttendanceDto.userId
        ? { eventId: createAttendanceDto.eventId, userId: createAttendanceDto.userId }
        : { eventId: createAttendanceDto.eventId, userEmail: createAttendanceDto.userEmail },
    });

    if (existing) {
      throw new ConflictException('Already registered for this event');
    }

    const attendance = this.attendanceRepository.create(createAttendanceDto);
    return this.attendanceRepository.save(attendance);
  }

  async checkIn(attendanceId: string): Promise<Attendance> {
    const attendance = await this.attendanceRepository.findOne({
      where: { id: attendanceId },
    });

    if (!attendance) {
      throw new NotFoundException(`Attendance with ID ${attendanceId} not found`);
    }

    attendance.checkedInAt = new Date();
    return this.attendanceRepository.save(attendance);
  }

  async findAll(eventId?: string): Promise<Attendance[]> {
    if (eventId) {
      return this.attendanceRepository.find({
        where: { eventId },
        relations: ['event', 'user'],
        order: { registeredAt: 'DESC' },
      });
    }
    return this.attendanceRepository.find({
      relations: ['event', 'user'],
      order: { registeredAt: 'DESC' },
    });
  }

  async remove(id: string): Promise<void> {
    await this.attendanceRepository.delete(id);
  }
}
