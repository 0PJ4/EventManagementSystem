require('dotenv').config();
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './entities/user.entity';
import { Organization } from './entities/organization.entity';
import { Event } from './entities/event.entity';
import { Resource } from './entities/resource.entity';
import { Attendance } from './entities/attendance.entity';
import { ResourceAllocation } from './entities/resource-allocation.entity';
import { Invite } from './entities/invite.entity';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'event_booking',
  entities: [User, Organization, Event, Resource, Attendance, ResourceAllocation, Invite],
  synchronize: false,
  logging: false,
});

async function createAdmin() {
  try {
    await dataSource.initialize();
    console.log('Database connected');

    const userRepo = dataSource.getRepository(User);

    // Check if admin already exists (only if role column exists)
    let existingAdmin = null;
    try {
      existingAdmin = await userRepo.findOne({
        where: { role: UserRole.ADMIN },
      });
    } catch (error: any) {
      // If role column doesn't exist, migrations haven't been run
      if (error.message?.includes('role') || error.code === '42703') {
        console.error('\n❌ Error: Database migrations have not been run!');
        console.log('\nPlease run migrations first:');
        console.log('  npm run migration:run');
        console.log('\nThen run this script again:');
        console.log('  npm run create-admin');
        await dataSource.destroy();
        process.exit(1);
      }
      throw error;
    }

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists!');
      console.log(`Email: ${existingAdmin.email}`);
      console.log('If you want to reset the password, please delete the existing admin first.');
      await dataSource.destroy();
      process.exit(0);
    }

    // Admin credentials
    const adminEmail = 'admin@eventbooking.com';
    const adminPassword = 'Admin@123';
    const adminName = 'System Administrator';

    // Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Create admin user
    const admin = userRepo.create({
      email: adminEmail,
      name: adminName,
      password: hashedPassword,
      role: UserRole.ADMIN,
      organizationId: null, // Admin doesn't belong to any organization
    });

    await userRepo.save(admin);

    console.log('\n✅ Admin account created successfully!');
    console.log('\n📋 Admin Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email:    ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  IMPORTANT: Change the password after first login!');

    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin account:', error);
    await dataSource.destroy();
    process.exit(1);
  }
}

createAdmin();
