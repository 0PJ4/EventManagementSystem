import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

/**
 * Migration: Create Inventory Transactions Table
 * 
 * Implements a transactional ledger model for consumable resources.
 * This replaces the static inventory model with a time-based transaction log.
 */
export class CreateInventoryTransactions1700000000010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create inventory_transactions table
    await queryRunner.createTable(
      new Table({
        name: 'inventory_transactions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'resourceId',
            type: 'uuid',
          },
          {
            name: 'quantity',
            type: 'int',
            comment: 'Positive for restock/return, Negative for allocation/usage',
          },
          {
            name: 'type',
            type: 'varchar',
            length: '50',
            comment: 'Transaction type: restock, allocation, adjustment, return',
          },
          {
            name: 'transactionDate',
            type: 'timestamp',
            comment: 'When this transaction takes effect',
          },
          {
            name: 'relatedEventId',
            type: 'uuid',
            isNullable: true,
            comment: 'Reference to event (for allocations)',
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdBy',
            type: 'varchar',
            length: '255',
            isNullable: true,
            comment: 'User who created this transaction',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Add foreign key to resources
    await queryRunner.createForeignKey(
      'inventory_transactions',
      new TableForeignKey({
        columnNames: ['resourceId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'resources',
        onDelete: 'CASCADE',
        name: 'FK_inventory_transactions_resource',
      }),
    );

    // Add foreign key to events (nullable)
    await queryRunner.createForeignKey(
      'inventory_transactions',
      new TableForeignKey({
        columnNames: ['relatedEventId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'events',
        onDelete: 'SET NULL',
        name: 'FK_inventory_transactions_event',
      }),
    );

    // Create composite index for efficient time-based queries
    // This is critical for performance when calculating projected balances
    await queryRunner.createIndex(
      'inventory_transactions',
      new TableIndex({
        name: 'IDX_inventory_transactions_resource_date',
        columnNames: ['resourceId', 'transactionDate'],
      }),
    );

    // Create index for event-related lookups (cancellations, modifications)
    await queryRunner.createIndex(
      'inventory_transactions',
      new TableIndex({
        name: 'IDX_inventory_transactions_event',
        columnNames: ['relatedEventId'],
      }),
    );

    // Create index for resource lookups
    await queryRunner.createIndex(
      'inventory_transactions',
      new TableIndex({
        name: 'IDX_inventory_transactions_resource',
        columnNames: ['resourceId'],
      }),
    );

    // Create index for chronological queries
    await queryRunner.createIndex(
      'inventory_transactions',
      new TableIndex({
        name: 'IDX_inventory_transactions_date',
        columnNames: ['transactionDate'],
      }),
    );

    // Add cachedCurrentStock column to resources table for performance
    await queryRunner.query(`
      ALTER TABLE resources 
      ADD COLUMN "cachedCurrentStock" INT DEFAULT NULL;
    `);

    // Update cachedCurrentStock to match availableQuantity for existing resources
    await queryRunner.query(`
      UPDATE resources 
      SET "cachedCurrentStock" = "availableQuantity" 
      WHERE type = 'consumable';
    `);

    // Create initial RESTOCK transactions for all existing consumable resources
    // This preserves the current inventory state in the new ledger model
    await queryRunner.query(`
      INSERT INTO inventory_transactions (
        "resourceId",
        quantity,
        type,
        "transactionDate",
        "relatedEventId",
        notes,
        "createdBy",
        "createdAt"
      )
      SELECT 
        r.id,
        r."availableQuantity",
        'restock',
        r."createdAt",
        NULL,
        'Initial stock migration from static inventory model',
        'system',
        CURRENT_TIMESTAMP
      FROM resources r
      WHERE r.type = 'consumable' AND r."availableQuantity" > 0;
    `);

    // Migrate existing allocations to negative transactions
    // This ensures historical accuracy in the ledger
    await queryRunner.query(`
      INSERT INTO inventory_transactions (
        "resourceId",
        quantity,
        type,
        "transactionDate",
        "relatedEventId",
        notes,
        "createdBy",
        "createdAt"
      )
      SELECT 
        ra."resourceId",
        -ra.quantity,
        'allocation',
        e."startTime",
        ra."eventId",
        'Migrated allocation from static model',
        'system',
        ra."allocatedAt"
      FROM resource_allocations ra
      INNER JOIN events e ON ra."eventId" = e.id
      INNER JOIN resources r ON ra."resourceId" = r.id
      WHERE r.type = 'consumable';
    `);

    // Recalculate cachedCurrentStock based on transaction ledger
    await queryRunner.query(`
      UPDATE resources r
      SET "cachedCurrentStock" = (
        SELECT COALESCE(SUM(it.quantity), 0)
        FROM inventory_transactions it
        WHERE it."resourceId" = r.id
      )
      WHERE r.type = 'consumable';
    `);

    // Create a function to recalculate cached stock (utility for maintenance)
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION recalculate_cached_stock(p_resource_id UUID)
      RETURNS INT AS $$
      DECLARE
        v_stock INT;
      BEGIN
        SELECT COALESCE(SUM(quantity), 0)
        INTO v_stock
        FROM inventory_transactions
        WHERE "resourceId" = p_resource_id;
        
        UPDATE resources
        SET "cachedCurrentStock" = v_stock
        WHERE id = p_resource_id;
        
        RETURN v_stock;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create a function to calculate projected balance at a specific date
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION get_projected_balance(
        p_resource_id UUID,
        p_date TIMESTAMP
      )
      RETURNS INT AS $$
      DECLARE
        v_balance INT;
      BEGIN
        SELECT COALESCE(SUM(quantity), 0)
        INTO v_balance
        FROM inventory_transactions
        WHERE "resourceId" = p_resource_id
          AND "transactionDate" <= p_date;
        
        RETURN v_balance;
      END;
      $$ LANGUAGE plpgsql;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop functions
    await queryRunner.query(`DROP FUNCTION IF EXISTS get_projected_balance(UUID, TIMESTAMP);`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS recalculate_cached_stock(UUID);`);

    // Drop cachedCurrentStock column from resources
    await queryRunner.query(`ALTER TABLE resources DROP COLUMN IF EXISTS "cachedCurrentStock";`);

    // Drop indexes
    await queryRunner.dropIndex('inventory_transactions', 'IDX_inventory_transactions_date');
    await queryRunner.dropIndex('inventory_transactions', 'IDX_inventory_transactions_resource');
    await queryRunner.dropIndex('inventory_transactions', 'IDX_inventory_transactions_event');
    await queryRunner.dropIndex('inventory_transactions', 'IDX_inventory_transactions_resource_date');

    // Drop foreign keys
    await queryRunner.dropForeignKey('inventory_transactions', 'FK_inventory_transactions_event');
    await queryRunner.dropForeignKey('inventory_transactions', 'FK_inventory_transactions_resource');

    // Drop table
    await queryRunner.dropTable('inventory_transactions');
  }
}
