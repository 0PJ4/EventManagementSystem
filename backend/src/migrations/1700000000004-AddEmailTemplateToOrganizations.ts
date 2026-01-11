import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailTemplateToOrganizations1700000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add emailTemplate column to organizations table
    await queryRunner.query(`
      ALTER TABLE organizations 
      ADD COLUMN IF NOT EXISTS "emailTemplate" VARCHAR(255) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE organizations DROP COLUMN IF EXISTS "emailTemplate"`);
  }
}
