import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordToUsers1700000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add password column to users table
    await queryRunner.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS password VARCHAR(255) NOT NULL DEFAULT ''
    `);

    // Update existing users with a default password (users should change this)
    // In production, you'd want to handle this differently
    await queryRunner.query(`
      UPDATE users 
      SET password = '$2b$10$dummy.hash.for.existing.users.please.update' 
      WHERE password = ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS password`);
  }
}
