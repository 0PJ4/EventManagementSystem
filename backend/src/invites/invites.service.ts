import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { randomUUID } from 'crypto';
import { MailerService } from '@nestjs-modules/mailer';
import { Invite, InviteStatus } from '../entities/invite.entity';
import { Event } from '../entities/event.entity';
import { User, UserRole } from '../entities/user.entity';
import { Organization } from '../entities/organization.entity';
import { Attendance } from '../entities/attendance.entity';
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
    @InjectRepository(Attendance)
    private attendanceRepository: Repository<Attendance>,
    private attendancesService: AttendancesService,
    private mailerService: MailerService,
  ) {}

  async create(createInviteDto: CreateInviteDto, currentUser?: { role: UserRole; id: string; organizationId?: string | null }): Promise<Invite> {
    // Validate event exists
    const event = await this.eventRepository.findOne({
      where: { id: createInviteDto.eventId },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${createInviteDto.eventId} not found`);
    }

    // For Super Admins: use the event's organization as the inviting organization
    // For Org Admins: validate that the organization exists and owns the event
    let effectiveOrganizationId: string;
    
    if (currentUser?.role === UserRole.ADMIN) {
      // Super Admin: Use the event's organization (or null if global event)
      effectiveOrganizationId = event.organizationId;
      
      // For global events (organizationId is null), we need to handle this differently
      if (!effectiveOrganizationId) {
        throw new BadRequestException(
          'Cannot send invites for global events. Please assign the event to an organization first.'
        );
      }
    } else {
      // Org Admin: Must provide organizationId and it must match the event's organization
      if (!createInviteDto.invitedByOrganizationId) {
        throw new BadRequestException(
          'Organization ID is required for organization admins'
        );
      }
      
      effectiveOrganizationId = createInviteDto.invitedByOrganizationId;
      
      // Event must belong to the organization that's sending the invite
      if (event.organizationId !== createInviteDto.invitedByOrganizationId) {
        throw new ForbiddenException(
          'Organization can only invite users to their own events'
        );
      }
    }

    // Validate organization exists
    const organization = await this.organizationRepository.findOne({
      where: { id: effectiveOrganizationId },
    });

    if (!organization) {
      throw new NotFoundException(
        `Organization with ID ${effectiveOrganizationId} not found`
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

      // For Super Admins: Can invite any user to any event
      // For Org Admins: Can invite:
      //   1. Users from their own organization
      //   2. Independent users (organizationId is null)
      //   They CANNOT invite users from OTHER organizations
      if (currentUser?.role !== UserRole.ADMIN) {
        if (user.organizationId && user.organizationId !== event.organizationId) {
          throw new ForbiddenException(
            'Cannot invite users from other organizations'
          );
        }
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

    // Check if an active (non-declined) invite already exists
    // We allow multiple DECLINED invites for history, but only one active invite
    const existingActiveInvite = await this.inviteRepository.findOne({
      where: createInviteDto.userId
        ? { 
            eventId: createInviteDto.eventId, 
            userId: createInviteDto.userId,
            status: InviteStatus.PENDING // Check for pending invites
          }
        : { 
            eventId: createInviteDto.eventId, 
            userEmail: createInviteDto.userEmail,
            status: InviteStatus.PENDING // Check for pending invites
          },
    });

    if (existingActiveInvite) {
      throw new ConflictException('Invite already sent and is pending');
    }

    // Check if user previously accepted but is no longer registered
    // Allow resending invite in this case
    if (createInviteDto.userId) {
      const existingAcceptedInvite = await this.inviteRepository.findOne({
        where: { 
          eventId: createInviteDto.eventId, 
          userId: createInviteDto.userId,
          status: InviteStatus.ACCEPTED
        },
      });

      if (existingAcceptedInvite) {
        // User accepted but unregistered - reset invite to PENDING to allow resending
        existingAcceptedInvite.status = InviteStatus.PENDING;
        existingAcceptedInvite.respondedAt = null;
        // Regenerate token for external invites (if applicable)
        if (!createInviteDto.userId && createInviteDto.userEmail) {
          existingAcceptedInvite.token = randomUUID();
        }
        const updatedInvite = await this.inviteRepository.save(existingAcceptedInvite);
        
        // Send email notification for resent invite
        await this.sendInviteEmailNotification(updatedInvite, event, createInviteDto.userId, createInviteDto.userEmail, createInviteDto.userName);
        return updatedInvite;
      }
    }

    // For DECLINED invites: Create a NEW invite record
    // The declined invite stays in the database for history tracking
    // Multiple declined invites are allowed, but only one active (PENDING/ACCEPTED/CANCELLED) invite
    
    // For CANCELLED invites: Delete the old one and create a new one
    const existingCancelledInvite = await this.inviteRepository.findOne({
      where: createInviteDto.userId
        ? { eventId: createInviteDto.eventId, userId: createInviteDto.userId, status: InviteStatus.CANCELLED }
        : { eventId: createInviteDto.eventId, userEmail: createInviteDto.userEmail, status: InviteStatus.CANCELLED },
    });
    
    if (existingCancelledInvite) {
      await this.inviteRepository.remove(existingCancelledInvite);
      // Continue to create new invite below
    }

    // Create new invite record
    // Ensure all fields are properly set, especially userName for external invites
    const invite = this.inviteRepository.create({
      eventId: createInviteDto.eventId,
      userId: createInviteDto.userId || null,
      userEmail: createInviteDto.userEmail || null,
      userName: createInviteDto.userName || null, // Ensure name is recorded properly for external invites
      invitedByOrganizationId: effectiveOrganizationId,
      invitedByUserId: createInviteDto.invitedByUserId || null,
      status: InviteStatus.PENDING,
      respondedAt: null,
    });
    
    // Generate token for external invites (userEmail without userId)
    if (!createInviteDto.userId && createInviteDto.userEmail) {
      invite.token = randomUUID();
    }
    
    const savedInvite = await this.inviteRepository.save(invite);
    
    // Send email notification
    await this.sendInviteEmailNotification(savedInvite, event, createInviteDto.userId, createInviteDto.userEmail, createInviteDto.userName);
    
    return savedInvite;
  }

  async findAll(eventId?: string, organizationId?: string, userId?: string, search?: string): Promise<Invite[]> {
    const queryBuilder = this.inviteRepository
      .createQueryBuilder('invite')
      .leftJoinAndSelect('invite.event', 'event')
      .leftJoinAndSelect('invite.user', 'user')
      .leftJoinAndSelect('invite.invitedByOrganization', 'invitedByOrganization')
      .leftJoinAndSelect('invite.invitedByUser', 'invitedByUser');
    
    if (eventId) {
      queryBuilder.andWhere('invite.eventId = :eventId', { eventId });
    }
    
    if (organizationId) {
      queryBuilder.andWhere('invite.invitedByOrganizationId = :organizationId', { organizationId });
    }
    
    if (userId) {
      queryBuilder.andWhere('invite.userId = :userId', { userId });
    }

    // Apply search filter (event.title OR user.name OR user.email OR userEmail OR userName)
    if (search && search.trim()) {
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where('event.title ILIKE :search', { search: `%${search.trim()}%` })
            .orWhere('user.name ILIKE :search', { search: `%${search.trim()}%` })
            .orWhere('user.email ILIKE :search', { search: `%${search.trim()}%` })
            .orWhere('invite.userEmail ILIKE :search', { search: `%${search.trim()}%` })
            .orWhere('invite.userName ILIKE :search', { search: `%${search.trim()}%` });
        })
      );
    }

    return queryBuilder
      .orderBy('invite.createdAt', 'DESC')
      .getMany();
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

  async cancel(id: string, user: { role: UserRole; organizationId?: string | null }): Promise<Invite> {
    const invite = await this.findOne(id);

    // Super Admin can cancel any invite
    if (user.role !== UserRole.ADMIN) {
      // Org Admin can only cancel invites from their organization
      if (!user.organizationId || invite.invitedByOrganizationId !== user.organizationId) {
        throw new ForbiddenException('Only the inviting organization can cancel invites');
      }
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException(`Cannot cancel invite that is ${invite.status}`);
    }

    invite.status = InviteStatus.CANCELLED;
    invite.respondedAt = new Date();

    await this.inviteRepository.save(invite);
    
    // Return the full invite object with relations to ensure proper JSON response
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.inviteRepository.delete(id);
  }

  // Public methods for external invites (magic links)
  async getPublicInvite(token: string): Promise<{ event: { id: string; title: string; startTime: Date; endTime: Date; description: string | null }; invite: { id: string; userEmail: string | null; userName: string | null; status: InviteStatus }; attendanceId?: string }> {
    const invite = await this.inviteRepository.findOne({
      where: { token },
      relations: ['event'],
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    // Allow viewing if pending or accepted (for check-in functionality)
    if (invite.status === InviteStatus.CANCELLED) {
      throw new BadRequestException('This invite has been cancelled');
    }

    if (invite.status === InviteStatus.DECLINED) {
      throw new BadRequestException('This invite has been declined');
    }

    // If invite is accepted, try to find the attendance ID
    let attendanceId: string | undefined;
    if (invite.status === InviteStatus.ACCEPTED && invite.userEmail) {
      const attendance = await this.attendanceRepository.findOne({
        where: {
          eventId: invite.eventId,
          userEmail: invite.userEmail,
          userId: null,
        },
      });
      if (attendance) {
        attendanceId = attendance.id;
      }
    }

    return {
      event: {
        id: invite.event.id,
        title: invite.event.title,
        startTime: invite.event.startTime,
        endTime: invite.event.endTime,
        description: invite.event.description,
      },
      invite: {
        id: invite.id,
        userEmail: invite.userEmail,
        userName: invite.userName,
        status: invite.status,
      },
      ...(attendanceId && { attendanceId }),
    };
  }

  async acceptPublic(token: string): Promise<{ invite: Invite; attendanceId: string }> {
    const invite = await this.inviteRepository.findOne({
      where: { token },
      relations: ['event'],
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException(`Invite is already ${invite.status}`);
    }

    if (!invite.userEmail) {
      throw new BadRequestException('This invite requires a user account');
    }

    invite.status = InviteStatus.ACCEPTED;
    invite.respondedAt = new Date();

    await this.inviteRepository.save(invite);

    // Automatically register the external attendee for the event
    let attendanceId: string;
    try {
      const attendance = await this.attendancesService.register({
        eventId: invite.eventId,
        userId: null,
        userEmail: invite.userEmail,
        userName: invite.userName,
      });
      attendanceId = attendance.id;
    } catch (error) {
      // If registration fails, revert invite status
      invite.status = InviteStatus.PENDING;
      invite.respondedAt = null;
      await this.inviteRepository.save(invite);
      throw error;
    }

    return { invite, attendanceId };
  }

  async declinePublic(token: string): Promise<Invite> {
    const invite = await this.inviteRepository.findOne({
      where: { token },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException(`Invite is already ${invite.status}`);
    }

    invite.status = InviteStatus.DECLINED;
    invite.respondedAt = new Date();

    return this.inviteRepository.save(invite);
  }

  /**
   * Helper method to send invite email notifications
   * Extracted to avoid code duplication when resending invites
   */
  private async sendInviteEmailNotification(
    invite: Invite,
    event: Event,
    userId?: string,
    userEmail?: string,
    userName?: string
  ): Promise<void> {
    try {
      let recipientEmail: string;
      let recipientName: string;
      
      if (userId) {
        const user = await this.userRepository.findOne({
          where: { id: userId },
        });
        if (user) {
          recipientEmail = user.email;
          recipientName = user.name;
        }
      } else if (userEmail) {
        recipientEmail = userEmail;
        recipientName = userName || 'Guest';
      }
      
      if (recipientEmail) {
        // Build the invite link
        let inviteLink: string;
        if (invite.token) {
          // External invite with token
          inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/invites/${invite.token}`;
        } else {
          // Internal invite - user needs to log in first
          inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/my-invites`;
        }
        
        await this.mailerService.sendMail({
          to: recipientEmail,
          subject: `You have been invited to ${event.title}`,
          html: `
            <h2>Event Invitation</h2>
            <p>Hello ${recipientName},</p>
            <p>You have been invited to attend: <strong>${event.title}</strong></p>
            <p><strong>Event Details:</strong></p>
            <ul>
              <li>Start Time: ${new Date(event.startTime).toLocaleString()}</li>
              <li>End Time: ${new Date(event.endTime).toLocaleString()}</li>
            </ul>
            ${event.description ? `<p>${event.description}</p>` : ''}
            <p>
              <a href="${inviteLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
                ${invite.token ? 'Accept Invitation' : 'View Invitation'}
              </a>
            </p>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p>${inviteLink}</p>
          `,
          text: `
            Event Invitation
            
            Hello ${recipientName},
            
            You have been invited to attend: ${event.title}
            
            Event Details:
            - Start Time: ${new Date(event.startTime).toLocaleString()}
            - End Time: ${new Date(event.endTime).toLocaleString()}
            
            ${event.description ? `Description: ${event.description}` : ''}
            
            Click here to accept: ${inviteLink}
          `,
        });
      }
    } catch (error) {
      // Log error but don't fail the invite creation
      console.error('Failed to send invite email:', error);
    }
  }
}
