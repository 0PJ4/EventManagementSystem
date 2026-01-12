import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to update invite unique constraints
 * 
 * Changes:
 * - Allow multiple DECLINED invites for the same event+email/userId (for history)
 * - Only enforce uniqueness for PENDING/ACCEPTED/CANCELLED invites
 * - This allows admins to resend invites to users who declined without deleting history
 */
export class UpdateInviteUniqueConstraint1700000000007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the old unique indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_invites_event_user_unique"
    `);
    
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_invites_event_email_unique"
    `);

    // Create new partial unique indexes that exclude DECLINED invites
    // This allows multiple declined invites (for history) but only one active invite
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_invites_event_user_unique" 
      ON invites ("eventId", "userId") 
      WHERE "userId" IS NOT NULL AND "status" != 'declined'
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_invites_event_email_unique" 
      ON invites ("eventId", "userEmail") 
      WHERE "userId" IS NULL AND "status" != 'declined'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the new indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_invites_event_user_unique"
    `);
    
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_invites_event_email_unique"
    `);

    // Restore the old indexes (without status filter)
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
  }
}
