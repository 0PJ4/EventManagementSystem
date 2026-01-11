import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany, Check } from 'typeorm';
import { Organization } from './organization.entity';
import { ResourceAllocation } from './resource-allocation.entity';

export enum ResourceType {
  EXCLUSIVE = 'exclusive',
  SHAREABLE = 'shareable',
  CONSUMABLE = 'consumable',
}

@Entity('resources')
@Check(`"availableQuantity" >= 0`)
@Check(`("type" = 'shareable' AND "maxConcurrentUsage" > 0) OR ("type" != 'shareable')`)
export class Resource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: ResourceType })
  type: ResourceType;

  @Column({ type: 'uuid', nullable: true })
  organizationId: string | null;

  @ManyToOne(() => Organization, organization => organization.resources, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization | null;

  @Column({ type: 'int', default: 1 })
  availableQuantity: number;

  @Column({ type: 'int', nullable: true })
  maxConcurrentUsage: number | null;

  @Column({ type: 'boolean', default: false })
  isGlobal: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @OneToMany(() => ResourceAllocation, allocation => allocation.resource)
  allocations: ResourceAllocation[];
}
