require('dotenv').config();
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'event_booking',
  synchronize: false,
  logging: false,
});

async function addAdmin() {
  try {
    await dataSource.initialize();
    console.log('Database connected. Adding admin user...');

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check if admin with this email already exists
      const existingAdminByEmail = await queryRunner.query(
        `SELECT id, email, role FROM users WHERE email = $1`,
        ['admin@eventbooking.com']
      );

      if (existingAdminByEmail.length > 0) {
        console.log('⚠️  Admin user with email admin@eventbooking.com already exists.');
        console.log('Updating password...');
        
        const hashedPassword = await bcrypt.hash('Admin@123', 10);
        await queryRunner.query(
          `UPDATE users SET password = $1, role = $2 WHERE email = $3`,
          [hashedPassword, 'admin', 'admin@eventbooking.com']
        );
        console.log('✅ Password and role updated successfully!');
        await queryRunner.commitTransaction();
        return;
      }

      // Check if any admin exists (by role)
      const existingAdminByRole = await queryRunner.query(
        `SELECT id, email FROM users WHERE role = $1`,
        ['admin']
      );

      if (existingAdminByRole.length > 0) {
        console.log('⚠️  An admin user already exists with a different email.');
        console.log(`   Existing admin email: ${existingAdminByRole[0].email}`);
        console.log('   Creating additional admin user with email admin@eventbooking.com...');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash('Admin@123', 10);

      // Insert admin user
      const result = await queryRunner.query(
        `INSERT INTO users (id, email, name, password, role, "organizationId", "createdAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, NULL, NOW())
         RETURNING id, email, name, role`,
        ['admin@eventbooking.com', 'System Administrator', hashedPassword, 'admin']
      );

      await queryRunner.commitTransaction();
      console.log('✅ Admin user created successfully!');
      console.log(`   Email: ${result[0].email}`);
      console.log(`   Name: ${result[0].name}`);
      console.log(`   Role: ${result[0].role}`);
      console.log(`   Password: Admin@123`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
      await dataSource.destroy();
    }
  } catch (error) {
    console.error('❌ Error adding admin user:', error);
    process.exit(1);
  }
}

addAdmin();
