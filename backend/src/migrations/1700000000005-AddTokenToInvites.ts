import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTokenToInvites1700000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add token column to invites table
    await queryRunner.query(`
      ALTER TABLE invites 
      ADD COLUMN IF NOT EXISTS token VARCHAR(255) NULL
    `);

    // Create unique index on token column
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_invites_token" 
      ON invites(token) 
      WHERE token IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_invites_token"
    `);

    // Drop column
    await queryRunner.query(`
      ALTER TABLE invites DROP COLUMN IF EXISTS token
    `);
  }
}
