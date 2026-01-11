import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class UserRolesAndInvites1700000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add role column to users table
    await queryRunner.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS role VARCHAR(255) DEFAULT 'user' CHECK (role IN ('admin', 'org', 'user'))
    `);

    // Make organizationId nullable in users table
    await queryRunner.query(`
      ALTER TABLE users 
      ALTER COLUMN "organizationId" DROP NOT NULL
    `);

    // Add unique constraint to email
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_email_unique" ON users (email)
    `);

    // Drop existing foreign key constraint
    await queryRunner.query(`
      ALTER TABLE users 
      DROP CONSTRAINT IF EXISTS "FK_users_organizationId"
    `);

    // Recreate foreign key with SET NULL on delete
    await queryRunner.query(`
      ALTER TABLE users 
      ADD CONSTRAINT "FK_users_organizationId" 
      FOREIGN KEY ("organizationId") 
      REFERENCES organizations(id) 
      ON DELETE SET NULL
    `);

    // Create invites table
    await queryRunner.createTable(
      new Table({
        name: 'invites',
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
            name: 'userId',
            type: 'uuid',
            isNullable: true,
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
            name: 'invitedByOrganizationId',
            type: 'uuid',
          },
          {
            name: 'invitedByUserId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'accepted', 'declined', 'cancelled'],
            default: "'pending'",
          },
          {
            name: 'respondedAt',
            type: 'timestamp',
            isNullable: true,
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

    // Add foreign keys for invites
    await queryRunner.createForeignKey(
      'invites',
      new TableForeignKey({
        columnNames: ['eventId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'events',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'invites',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'invites',
      new TableForeignKey({
        columnNames: ['invitedByOrganizationId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'organizations',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'invites',
      new TableForeignKey({
        columnNames: ['invitedByUserId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );

    // Add check constraint for invites (either userId or userEmail, not both)
    await queryRunner.query(`
      ALTER TABLE invites 
      ADD CONSTRAINT "CHK_invites_user_or_email" 
      CHECK (("userId" IS NOT NULL AND "userEmail" IS NULL) OR ("userId" IS NULL AND "userEmail" IS NOT NULL))
    `);

    // Add unique indexes for invites
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_invites_event_user_unique" 
      ON invites ("eventId", "userId") 
      WHERE "userId" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_invites_event_email_unique" 
      ON invites ("eventId", "userEmail") 
      WHERE "userId" IS NULL
    `);

    // Add indexes for performance
    await queryRunner.createIndex(
      'invites',
      new TableIndex({
        name: 'IDX_invites_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'invites',
      new TableIndex({
        name: 'IDX_invites_event',
        columnNames: ['eventId'],
      }),
    );

    await queryRunner.createIndex(
      'invites',
      new TableIndex({
        name: 'IDX_invites_organization',
        columnNames: ['invitedByOrganizationId'],
      }),
    );

    await queryRunner.createIndex(
      'invites',
      new TableIndex({
        name: 'IDX_invites_user',
        columnNames: ['userId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop invites table and its constraints
    await queryRunner.query(`DROP TABLE IF EXISTS invites CASCADE`);

    // Remove unique constraint from email
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_email_unique"`);

    // Make organizationId NOT NULL again
    await queryRunner.query(`
      ALTER TABLE users 
      ALTER COLUMN "organizationId" SET NOT NULL
    `);

    // Remove role column
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS role`);

    // Recreate foreign key with CASCADE on delete
    await queryRunner.query(`
      ALTER TABLE users 
      DROP CONSTRAINT IF EXISTS "FK_users_organizationId"
    `);

    await queryRunner.query(`
      ALTER TABLE users 
      ADD CONSTRAINT "FK_users_organizationId" 
      FOREIGN KEY ("organizationId") 
      REFERENCES organizations(id) 
      ON DELETE CASCADE
    `);
  }
}
