import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';
import { Event } from './event.entity';
import { Resource } from './resource.entity';

@Entity('resource_allocations')
@Index(['eventId', 'resourceId'], { unique: true })
@Check(`"quantity" > 0`)
export class ResourceAllocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  eventId: string;

  @ManyToOne(() => Event, event => event.resourceAllocations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column({ type: 'uuid' })
  resourceId: string;

  @ManyToOne(() => Resource, resource => resource.allocations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resourceId' })
  resource: Resource;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  allocatedAt: Date;
}
