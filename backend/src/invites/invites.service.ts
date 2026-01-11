import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invite, InviteStatus } from '../entities/invite.entity';
import { Event } from '../entities/event.entity';
import { User } from '../entities/user.entity';
import { Organization } from '../entities/organization.entity';
import { CreateInviteDto } from './dto/create-invite.dto';
import { UpdateInviteDto } from './dto/update-invite.dto';
import { AttendancesService } from '../attendances/attendances.service';

@Injectable()
export class InvitesService {
  constructor(
    @InjectRepository(Invite)
    private inviteRepository: Repository<Invite>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    private attendancesService: AttendancesService,
  ) {}

  async create(createInviteDto: CreateInviteDto): Promise<Invite> {
    // Validate event exists
    const event = await this.eventRepository.findOne({
      where: { id: createInviteDto.eventId },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${createInviteDto.eventId} not found`);
    }

    // Validate organization exists and owns the event
    const organization = await this.organizationRepository.findOne({
      where: { id: createInviteDto.invitedByOrganizationId },
    });

    if (!organization) {
      throw new NotFoundException(
        `Organization with ID ${createInviteDto.invitedByOrganizationId} not found`
      );
    }

    // Event must belong to the organization that's sending the invite
    if (event.organizationId !== createInviteDto.invitedByOrganizationId) {
      throw new ForbiddenException(
        'Organization can only invite users to their own events'
      );
    }

    // If inviting a user (not external email), validate user exists and can be invited
    if (createInviteDto.userId) {
      const user = await this.userRepository.findOne({
        where: { id: createInviteDto.userId },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${createInviteDto.userId} not found`);
      }

      // Org admins can invite:
      // 1. Users from their own organization
      // 2. Independent users (organizationId is null)
      // They CANNOT invite users from OTHER organizations
      if (user.organizationId && user.organizationId !== event.organizationId) {
        throw new ForbiddenException(
          'Cannot invite users from other organizations'
        );
      }
      // Independent users (user.organizationId === null) can be invited to any event
    }

    // Check if user is already registered for the event
    if (createInviteDto.userId) {
      const existingAttendance = await this.attendancesService.findAll(
        createInviteDto.eventId
      );
      const isAlreadyRegistered = existingAttendance.some(
        (attendance) => attendance.userId === createInviteDto.userId
      );

      if (isAlreadyRegistered) {
        throw new ConflictException('User is already registered for this event');
      }
    }

    // Check if invite already exists
    const existingInvite = await this.inviteRepository.findOne({
      where: createInviteDto.userId
        ? { eventId: createInviteDto.eventId, userId: createInviteDto.userId }
        : { eventId: createInviteDto.eventId, userEmail: createInviteDto.userEmail },
    });

    if (existingInvite) {
      if (existingInvite.status === InviteStatus.PENDING) {
        throw new ConflictException('Invite already sent and is pending');
      }
      // Allow resending invite if user previously accepted but is no longer registered
      // The check above for isAlreadyRegistered ensures user is not currently registered
      if (existingInvite.status === InviteStatus.ACCEPTED) {
        // User accepted but unregistered - reset invite to PENDING to allow resending
        existingInvite.status = InviteStatus.PENDING;
        existingInvite.respondedAt = null;
        return this.inviteRepository.save(existingInvite);
      }
      // If status is DECLINED or CANCELLED, allow creating a new invite (will be handled below)
    }

    const invite = this.inviteRepository.create(createInviteDto);
    return this.inviteRepository.save(invite);
  }

  async findAll(eventId?: string, organizationId?: string, userId?: string): Promise<Invite[]> {
    const where: any = {};
    
    if (eventId) {
      where.eventId = eventId;
    }
    
    if (organizationId) {
      where.invitedByOrganizationId = organizationId;
    }
    
    if (userId) {
      where.userId = userId;
    }

    return this.inviteRepository.find({
      where,
      relations: ['event', 'user', 'invitedByOrganization', 'invitedByUser'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Invite> {
    const invite = await this.inviteRepository.findOne({
      where: { id },
      relations: ['event', 'user', 'invitedByOrganization', 'invitedByUser'],
    });

    if (!invite) {
      throw new NotFoundException(`Invite with ID ${id} not found`);
    }

    return invite;
  }

  async accept(id: string, userId: string): Promise<Invite> {
    const invite = await this.findOne(id);

    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException(`Invite is already ${invite.status}`);
    }

    // STRICT: Only the invitee can accept
    if (invite.userId !== userId) {
      throw new ForbiddenException('You can only accept invites that are specifically for you');
    }

    invite.status = InviteStatus.ACCEPTED;
    invite.respondedAt = new Date();

    await this.inviteRepository.save(invite);

    // Automatically register the user for the event
    try {
      await this.attendancesService.register({
        eventId: invite.eventId,
        userId: invite.userId,
      });
    } catch (error) {
      // If registration fails, revert invite status
      invite.status = InviteStatus.PENDING;
      invite.respondedAt = null;
      await this.inviteRepository.save(invite);
      throw error;
    }

    return invite;
  }

  async decline(id: string, userId: string): Promise<Invite> {
    const invite = await this.findOne(id);

    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException(`Invite is already ${invite.status}`);
    }

    // STRICT: Only the invitee can decline
    if (invite.userId !== userId) {
      throw new ForbiddenException('You can only decline invites that are specifically for you');
    }

    invite.status = InviteStatus.DECLINED;
    invite.respondedAt = new Date();

    return this.inviteRepository.save(invite);
  }

  async cancel(id: string, organizationId: string): Promise<Invite> {
    const invite = await this.findOne(id);

    if (invite.invitedByOrganizationId !== organizationId) {
      throw new ForbiddenException('Only the inviting organization can cancel invites');
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException(`Cannot cancel invite that is ${invite.status}`);
    }

    invite.status = InviteStatus.CANCELLED;
    invite.respondedAt = new Date();

    return this.inviteRepository.save(invite);
  }

  async remove(id: string): Promise<void> {
    await this.inviteRepository.delete(id);
  }
}
