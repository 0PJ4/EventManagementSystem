import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';
import { User } from './user.entity';
import { Event } from './event.entity';
import { Organization } from './organization.entity';

export enum InviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  CANCELLED = 'cancelled',
}

@Entity('invites')
// Unique constraint: Only one active invite (PENDING/ACCEPTED/CANCELLED) per event+email
// Multiple DECLINED invites are allowed for history tracking
@Index(['eventId', 'userEmail'], { unique: true, where: '"userId" IS NULL AND "status" != \'declined\'' })
@Index(['eventId', 'userId'], { unique: true, where: '"userId" IS NOT NULL AND "status" != \'declined\'' })
@Check(`("userId" IS NOT NULL AND "userEmail" IS NULL) OR ("userId" IS NULL AND "userEmail" IS NOT NULL)`)
export class Invite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  eventId: string;

  @ManyToOne(() => Event, event => event.invites, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, user => user.invites, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userEmail: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userName: string | null;

  @Column({ type: 'uuid' })
  @Index()
  invitedByOrganizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invitedByOrganizationId' })
  invitedByOrganization: Organization;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  invitedByUserId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'invitedByUserId' })
  invitedByUser: User | null;

  @Column({ type: 'enum', enum: InviteStatus, default: InviteStatus.PENDING })
  status: InviteStatus;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  token: string | null;

  @Column({ type: 'timestamp', nullable: true })
  respondedAt: Date | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
