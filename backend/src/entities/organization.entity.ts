import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { Event } from './event.entity';
import { Resource } from './resource.entity';
import { Invite } from './invite.entity';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  emailTemplate: string | null; // e.g., "@abc.in" or "*.@abc.in"

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @OneToMany(() => User, user => user.organization)
  users: User[];

  @OneToMany(() => Event, event => event.organization)
  events: Event[];

  @OneToMany(() => Resource, resource => resource.organization)
  resources: Resource[];

  @OneToMany(() => Invite, invite => invite.invitedByOrganization)
  sentInvites: Invite[];
}
