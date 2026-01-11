import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex, TableCheck } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create organizations table
    await queryRunner.createTable(
      new Table({
        name: 'organizations',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
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

    // Create users table
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'organizationId',
            type: 'uuid',
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

    // Create events table
    await queryRunner.createTable(
      new Table({
        name: 'events',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'title',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'startTime',
            type: 'timestamp',
          },
          {
            name: 'endTime',
            type: 'timestamp',
          },
          {
            name: 'capacity',
            type: 'int',
            default: 0,
          },
          {
            name: 'organizationId',
            type: 'uuid',
          },
          {
            name: 'parentEventId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['draft', 'published', 'cancelled'],
            default: "'draft'",
          },
          {
            name: 'allowExternalAttendees',
            type: 'boolean',
            default: false,
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

    // Create resources table
    await queryRunner.createTable(
      new Table({
        name: 'resources',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['exclusive', 'shareable', 'consumable'],
          },
          {
            name: 'organizationId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'availableQuantity',
            type: 'int',
            default: 1,
          },
          {
            name: 'maxConcurrentUsage',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'isGlobal',
            type: 'boolean',
            default: false,
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

    // Create attendances table
    await queryRunner.createTable(
      new Table({
        name: 'attendances',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'eventId',
            type: 'uuid',
          },
          {
            name: 'userEmail',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'userName',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'checkedInAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'registeredAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create resource_allocations table
    await queryRunner.createTable(
      new Table({
        name: 'resource_allocations',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'eventId',
            type: 'uuid',
          },
          {
            name: 'resourceId',
            type: 'uuid',
          },
          {
            name: 'quantity',
            type: 'int',
            default: 1,
          },
          {
            name: 'allocatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Enable UUID extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // Add foreign keys with CASCADE
    await queryRunner.createForeignKey(
      'users',
      new TableForeignKey({
        columnNames: ['organizationId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'organizations',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'events',
      new TableForeignKey({
        columnNames: ['organizationId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'organizations',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'events',
      new TableForeignKey({
        columnNames: ['parentEventId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'events',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'resources',
      new TableForeignKey({
        columnNames: ['organizationId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'organizations',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'attendances',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'attendances',
      new TableForeignKey({
        columnNames: ['eventId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'events',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'resource_allocations',
      new TableForeignKey({
        columnNames: ['eventId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'events',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'resource_allocations',
      new TableForeignKey({
        columnNames: ['resourceId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'resources',
        onDelete: 'CASCADE',
      }),
    );

    // Add check constraints
    await queryRunner.query(
      `ALTER TABLE events ADD CONSTRAINT "CHK_endTime_after_startTime" CHECK ("endTime" > "startTime")`,
    );

    await queryRunner.query(
      `ALTER TABLE resources ADD CONSTRAINT "CHK_availableQuantity_non_negative" CHECK ("availableQuantity" >= 0)`,
    );

    await queryRunner.query(
      `ALTER TABLE resources ADD CONSTRAINT "CHK_shareable_maxConcurrentUsage" CHECK (("type" = 'shareable' AND "maxConcurrentUsage" > 0) OR ("type" != 'shareable'))`,
    );

    await queryRunner.query(
      `ALTER TABLE attendances ADD CONSTRAINT "CHK_user_or_email" CHECK (("userId" IS NOT NULL AND "userEmail" IS NULL) OR ("userId" IS NULL AND "userEmail" IS NOT NULL))`,
    );

    await queryRunner.query(
      `ALTER TABLE resource_allocations ADD CONSTRAINT "CHK_quantity_positive" CHECK ("quantity" > 0)`,
    );

    // Add composite unique constraints
    await queryRunner.createIndex(
      'resource_allocations',
      new TableIndex({
        name: 'IDX_resource_allocations_event_resource_unique',
        columnNames: ['eventId', 'resourceId'],
        isUnique: true,
      }),
    );

    // Partial unique index for attendances (user-based)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_attendances_event_user_unique" ON attendances ("eventId", "userId") WHERE "userId" IS NOT NULL`,
    );

    // Partial unique index for attendances (email-based)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_attendances_event_email_unique" ON attendances ("eventId", "userEmail") WHERE "userId" IS NULL`,
    );

    // Add indexes for performance
    await queryRunner.createIndex(
      'events',
      new TableIndex({
        name: 'IDX_events_org_time',
        columnNames: ['organizationId', 'startTime', 'endTime'],
      }),
    );

    await queryRunner.createIndex(
      'events',
      new TableIndex({
        name: 'IDX_events_parent',
        columnNames: ['parentEventId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('resource_allocations', true);
    await queryRunner.dropTable('attendances', true);
    await queryRunner.dropTable('resources', true);
    await queryRunner.dropTable('events', true);
    await queryRunner.dropTable('users', true);
    await queryRunner.dropTable('organizations', true);
  }
}
