import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, LessThanOrEqual } from 'typeorm';
import { InventoryTransaction, TransactionType } from '../entities/inventory-transaction.entity';
import { Resource, ResourceType } from '../entities/resource.entity';

/**
 * Inventory Service
 * 
 * Manages the transactional ledger for consumable resources.
 * Provides methods for:
 * - Calculating projected balances
 * - Creating transactions (restocks, allocations, returns)
 * - Validating availability
 */
@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryTransaction)
    private transactionRepository: Repository<InventoryTransaction>,
    @InjectRepository(Resource)
    private resourceRepository: Repository<Resource>,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  /**
   * Calculate projected balance for a resource at a specific date
   * 
   * @param resourceId - Resource to check
   * @param targetDate - Date to calculate balance for
   * @returns Projected quantity available at that date
   */
  async getProjectedBalance(resourceId: string, targetDate: Date): Promise<number> {
    const result = await this.dataSource.query(
      `SELECT get_projected_balance($1, $2) as balance;`,
      [resourceId, targetDate],
    );
    return parseInt(result[0]?.balance || '0', 10);
  }

  /**
   * Get current balance (sum of all transactions up to now)
   * 
   * @param resourceId - Resource to check
   * @returns Current quantity available
   */
  async getCurrentBalance(resourceId: string): Promise<number> {
    const resource = await this.resourceRepository.findOne({
      where: { id: resourceId },
      select: ['cachedCurrentStock', 'type'],
    });

    if (!resource) {
      throw new BadRequestException('Resource not found');
    }

    // For non-consumables, return availableQuantity
    if (resource.type !== ResourceType.CONSUMABLE) {
      return resource.cachedCurrentStock || 0;
    }

    // Use cached value if available
    if (resource.cachedCurrentStock !== null && resource.cachedCurrentStock !== undefined) {
      return resource.cachedCurrentStock;
    }

    // Fallback: calculate from transactions
    const result = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('COALESCE(SUM(transaction.quantity), 0)', 'balance')
      .where('transaction.resourceId = :resourceId', { resourceId })
      .getRawOne();

    return parseInt(result?.balance || '0', 10);
  }

  /**
   * Create an allocation transaction (consume inventory for an event)
   * 
   * Uses database-level row locking to prevent race conditions.
   * 
   * @param resourceId - Resource being allocated
   * @param quantity - Amount to allocate (positive number)
   * @param eventId - Event consuming the resource
   * @param eventStartTime - When the event starts (when inventory is consumed)
   * @param userId - User making the allocation
   * @returns Created transaction
   */
  async createAllocationTransaction(
    resourceId: string,
    quantity: number,
    eventId: string,
    eventStartTime: Date,
    userId?: string,
  ): Promise<InventoryTransaction> {
    if (quantity <= 0) {
      throw new BadRequestException('Allocation quantity must be positive');
    }

    // Use a database transaction with row-level locking
    return await this.dataSource.transaction(async (manager) => {
      // Lock the resource row to prevent concurrent allocations
      const resource = await manager
        .createQueryBuilder(Resource, 'resource')
        .setLock('pessimistic_write')
        .where('resource.id = :resourceId', { resourceId })
        .getOne();

      if (!resource) {
        throw new BadRequestException('Resource not found');
      }

      if (resource.type !== ResourceType.CONSUMABLE) {
        throw new BadRequestException('Allocation transactions are only for consumable resources');
      }

      // Calculate projected balance at event start time
      const projectedBalance = await this.getProjectedBalance(resourceId, eventStartTime);

      // Check if allocation would cause negative balance
      if (projectedBalance - quantity < 0) {
        throw new BadRequestException(
          `Insufficient inventory. Available: ${projectedBalance}, Requested: ${quantity}`,
        );
      }

      // Create negative transaction (allocation)
      const transaction = manager.create(InventoryTransaction, {
        resourceId,
        quantity: -quantity, // Negative = consumption
        type: TransactionType.ALLOCATION,
        transactionDate: eventStartTime,
        relatedEventId: eventId,
        notes: `Allocated for event ${eventId}`,
        createdBy: userId || null,
      });

      const savedTransaction = await manager.save(transaction);

      // Update cached stock
      await manager.query(
        `UPDATE resources SET "cachedCurrentStock" = "cachedCurrentStock" - $1 WHERE id = $2`,
        [quantity, resourceId],
      );

      return savedTransaction;
    });
  }

  /**
   * Create a return transaction (return unused inventory from cancelled/modified event)
   * 
   * @param resourceId - Resource being returned
   * @param quantity - Amount to return (positive number)
   * @param eventId - Event that was cancelled/modified
   * @param userId - User making the return
   * @returns Created transaction
   */
  async createReturnTransaction(
    resourceId: string,
    quantity: number,
    eventId: string,
    userId?: string,
  ): Promise<InventoryTransaction> {
    if (quantity <= 0) {
      throw new BadRequestException('Return quantity must be positive');
    }

    return await this.dataSource.transaction(async (manager) => {
      const transaction = manager.create(InventoryTransaction, {
        resourceId,
        quantity: quantity, // Positive = return
        type: TransactionType.RETURN,
        transactionDate: new Date(),
        relatedEventId: eventId,
        notes: `Returned from cancelled/modified event ${eventId}`,
        createdBy: userId || null,
      });

      const savedTransaction = await manager.save(transaction);

      // Update cached stock
      await manager.query(
        `UPDATE resources SET "cachedCurrentStock" = "cachedCurrentStock" + $1 WHERE id = $2`,
        [quantity, resourceId],
      );

      return savedTransaction;
    });
  }

  /**
   * Create a restock transaction (add new inventory)
   * 
   * @param resourceId - Resource being restocked
   * @param quantity - Amount to add (positive number)
   * @param restockDate - When inventory becomes available
   * @param notes - Optional notes about the restock
   * @param userId - User creating the restock
   * @returns Created transaction
   */
  async createRestockTransaction(
    resourceId: string,
    quantity: number,
    restockDate: Date,
    notes?: string,
    userId?: string,
  ): Promise<InventoryTransaction> {
    if (quantity <= 0) {
      throw new BadRequestException('Restock quantity must be positive');
    }

    return await this.dataSource.transaction(async (manager) => {
      const resource = await manager.findOne(Resource, { where: { id: resourceId } });

      if (!resource) {
        throw new BadRequestException('Resource not found');
      }

      if (resource.type !== ResourceType.CONSUMABLE) {
        throw new BadRequestException('Restock transactions are only for consumable resources');
      }

      const transaction = manager.create(InventoryTransaction, {
        resourceId,
        quantity: quantity, // Positive = restock
        type: TransactionType.RESTOCK,
        transactionDate: restockDate,
        relatedEventId: null,
        notes: notes || 'Inventory restock',
        createdBy: userId || null,
      });

      const savedTransaction = await manager.save(transaction);

      // Update cached stock
      await manager.query(
        `UPDATE resources SET "cachedCurrentStock" = "cachedCurrentStock" + $1 WHERE id = $2`,
        [quantity, resourceId],
      );

      return savedTransaction;
    });
  }

  /**
   * Get transaction history for a resource
   * 
   * @param resourceId - Resource to get history for
   * @param startDate - Optional start date filter
   * @param endDate - Optional end date filter
   * @returns List of transactions
   */
  async getTransactionHistory(
    resourceId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<InventoryTransaction[]> {
    const queryBuilder = this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.relatedEvent', 'event')
      .where('transaction.resourceId = :resourceId', { resourceId })
      .orderBy('transaction.transactionDate', 'ASC');

    if (startDate) {
      queryBuilder.andWhere('transaction.transactionDate >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('transaction.transactionDate <= :endDate', { endDate });
    }

    return queryBuilder.getMany();
  }

  /**
   * Get running balance over time (for reporting/visualization)
   * 
   * @param resourceId - Resource to analyze
   * @param startDate - Optional start date
   * @param endDate - Optional end date
   * @returns Array of {date, quantity, runningBalance}
   */
  async getRunningBalanceOverTime(
    resourceId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<Array<{ transactionDate: Date; quantity: number; runningBalance: number; type: string }>> {
    let query = `
      SELECT 
        "transactionDate",
        quantity,
        type,
        SUM(quantity) OVER (ORDER BY "transactionDate", "createdAt") as "runningBalance"
      FROM inventory_transactions
      WHERE "resourceId" = $1
    `;

    const params: any[] = [resourceId];
    let paramIndex = 2;

    if (startDate) {
      query += ` AND "transactionDate" >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND "transactionDate" <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += ` ORDER BY "transactionDate", "createdAt"`;

    const results = await this.dataSource.query(query, params);

    return results.map((row: any) => ({
      transactionDate: row.transactionDate,
      quantity: parseInt(row.quantity, 10),
      runningBalance: parseInt(row.runningBalance, 10),
      type: row.type,
    }));
  }

  /**
   * Detect inventory shortages (negative balances) at any point in time
   * 
   * @param resourceId - Optional: filter by specific resource
   * @returns List of resources with shortage periods
   */
  async detectInventoryShortages(resourceId?: string): Promise<
    Array<{
      resourceId: string;
      resourceName: string;
      transactionDate: Date;
      runningBalance: number;
      type: string;
    }>
  > {
    let query = `
      WITH running_totals AS (
        SELECT 
          it."resourceId",
          it."transactionDate",
          it.quantity,
          it.type,
          SUM(it.quantity) OVER (
            PARTITION BY it."resourceId" 
            ORDER BY it."transactionDate", it."createdAt"
          ) as running_balance
        FROM inventory_transactions it
        ${resourceId ? 'WHERE it."resourceId" = $1' : ''}
      )
      SELECT 
        rt."resourceId",
        r.name as "resourceName",
        rt."transactionDate",
        rt.running_balance as "runningBalance",
        rt.type
      FROM running_totals rt
      INNER JOIN resources r ON rt."resourceId" = r.id
      WHERE rt.running_balance < 0
      ORDER BY rt."resourceId", rt."transactionDate";
    `;

    const params: any[] = resourceId ? [resourceId] : [];
    return this.dataSource.query(query, params);
  }
}
