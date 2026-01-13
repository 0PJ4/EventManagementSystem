import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, CreateDateColumn } from 'typeorm';
import { Resource } from './resource.entity';
import { Event } from './event.entity';

export enum TransactionType {
  RESTOCK = 'restock',
  ALLOCATION = 'allocation',
  ADJUSTMENT = 'adjustment',
  RETURN = 'return', // When an event is cancelled and inventory is returned
}

/**
 * Inventory Transaction Entity
 * 
 * Implements a transactional ledger model for consumable resources.
 * Every inventory change is recorded as a transaction with:
 * - Positive quantity = Restock/Return (adding inventory)
 * - Negative quantity = Allocation/Usage (consuming inventory)
 * 
 * The current stock is calculated by summing all transactions up to a point in time.
 * This allows for:
 * - Time-based inventory queries
 * - Historical tracking
 * - Restocking over time
 * - Accurate projected availability
 */
@Entity('inventory_transactions')
// Composite index for efficient time-based queries
@Index(['resourceId', 'transactionDate'])
// Index for event-related lookups (cancellations, modifications)
@Index(['relatedEventId'])
export class InventoryTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index() // Individual index for resource lookups
  resourceId: string;

  @ManyToOne(() => Resource, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resourceId' })
  resource: Resource;

  /**
   * Quantity change
   * Positive: Restock, Return
   * Negative: Allocation, Usage
   */
  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  /**
   * When this transaction takes effect
   * For allocations: typically the event start time
   * For restocks: when inventory arrives
   */
  @Column({ type: 'timestamp' })
  @Index() // Index for chronological queries
  transactionDate: Date;

  /**
   * Optional reference to related event
   * Null for restocks/adjustments
   * Set for allocations (to track which event consumed the inventory)
   */
  @Column({ type: 'uuid', nullable: true })
  relatedEventId: string | null;

  @ManyToOne(() => Event, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'relatedEventId' })
  relatedEvent: Event | null;

  /**
   * Optional notes/reason for transaction
   */
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /**
   * User who created this transaction (for audit trail)
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  createdBy: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
