import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Check,
  Index,
} from 'typeorm';
import { Organization } from './organization.entity';
import { Attendance } from './attendance.entity';
import { ResourceAllocation } from './resource-allocation.entity';
import { Invite } from './invite.entity';

export enum EventStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  CANCELLED = 'cancelled',
}

@Entity('events')
@Check(`"endTime" > "startTime"`)
@Index(['organizationId', 'startTime', 'endTime'])
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'timestamp' })
  startTime: Date;

  @Column({ type: 'timestamp' })
  endTime: Date;

  @Column({ type: 'int', default: 0 })
  capacity: number;

  @Column({ type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, organization => organization.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  parentEventId: string | null;

  @ManyToOne(() => Event, event => event.childEvents, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parentEventId' })
  parentEvent: Event | null;

  @OneToMany(() => Event, event => event.parentEvent)
  childEvents: Event[];

  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.DRAFT })
  status: EventStatus;

  @Column({ type: 'boolean', default: false })
  allowExternalAttendees: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @OneToMany(() => Attendance, attendance => attendance.event)
  attendances: Attendance[];

  @OneToMany(() => ResourceAllocation, allocation => allocation.event)
  resourceAllocations: ResourceAllocation[];

  @OneToMany(() => Invite, invite => invite.event)
  invites: Invite[];
}
