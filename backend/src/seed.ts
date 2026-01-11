require('dotenv').config();
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { User } from './entities/user.entity';
import { Event, EventStatus } from './entities/event.entity';
import { Resource, ResourceType } from './entities/resource.entity';
import { Attendance } from './entities/attendance.entity';
import { ResourceAllocation } from './entities/resource-allocation.entity';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'event_booking',
  entities: [Organization, User, Event, Resource, Attendance, ResourceAllocation],
  synchronize: false,
  logging: false,
});

async function seed() {
  try {
    await dataSource.initialize();
    console.log('Database connected');

    const orgRepo = dataSource.getRepository(Organization);
    const userRepo = dataSource.getRepository(User);
    const eventRepo = dataSource.getRepository(Event);
    const resourceRepo = dataSource.getRepository(Resource);
    const attendanceRepo = dataSource.getRepository(Attendance);
    const allocationRepo = dataSource.getRepository(ResourceAllocation);

    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log('Clearing existing data...');
    // Delete in order to respect foreign key constraints (using query builder)
    await allocationRepo.createQueryBuilder().delete().execute();
    await attendanceRepo.createQueryBuilder().delete().execute();
    await eventRepo.createQueryBuilder().delete().execute();
    await resourceRepo.createQueryBuilder().delete().execute();
    await userRepo.createQueryBuilder().delete().execute();
    await orgRepo.createQueryBuilder().delete().execute();

    // Create Organizations
    console.log('Creating organizations...');
    const org1 = orgRepo.create({ name: 'Acme Corporation' });
    const org2 = orgRepo.create({ name: 'Tech Solutions Inc' });
    const savedOrgs = await orgRepo.save([org1, org2]);
    console.log(`Created ${savedOrgs.length} organizations`);

    // Create Users
    console.log('Creating users...');
    const users = [
      userRepo.create({
        name: 'John Doe',
        email: 'john.doe@acme.com',
        organizationId: savedOrgs[0].id,
      }),
      userRepo.create({
        name: 'Jane Smith',
        email: 'jane.smith@acme.com',
        organizationId: savedOrgs[0].id,
      }),
      userRepo.create({
        name: 'Bob Johnson',
        email: 'bob.johnson@tech.com',
        organizationId: savedOrgs[1].id,
      }),
      userRepo.create({
        name: 'Alice Williams',
        email: 'alice.williams@tech.com',
        organizationId: savedOrgs[1].id,
      }),
    ];
    const savedUsers = await userRepo.save(users);
    console.log(`Created ${savedUsers.length} users`);

    // Create Events
    console.log('Creating events...');
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const events = [
      eventRepo.create({
        title: 'Team Meeting',
        description: 'Weekly team sync meeting',
        startTime: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Tomorrow
        endTime: new Date(now.getTime() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // Tomorrow + 1 hour
        capacity: 20,
        organizationId: savedOrgs[0].id,
        status: EventStatus.PUBLISHED,
        allowExternalAttendees: false,
      }),
      eventRepo.create({
        title: 'Conference 2024',
        description: 'Annual company conference',
        startTime: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        endTime: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000), // + 4 hours
        capacity: 100,
        organizationId: savedOrgs[0].id,
        status: EventStatus.PUBLISHED,
        allowExternalAttendees: true,
      }),
      eventRepo.create({
        title: 'Workshop: Advanced SQL',
        description: 'Technical workshop on advanced SQL queries',
        startTime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        endTime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // + 2 hours
        capacity: 30,
        organizationId: savedOrgs[1].id,
        status: EventStatus.PUBLISHED,
        allowExternalAttendees: false,
      }),
    ];

    // Create a parent event with child events
    const parentEvent = eventRepo.create({
      title: 'Training Series',
      description: 'Multi-session training program',
      startTime: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000),
      capacity: 50,
      organizationId: savedOrgs[0].id,
      status: EventStatus.PUBLISHED,
      allowExternalAttendees: false,
    });
    const savedParent = await eventRepo.save(parentEvent);

    const childEvent = eventRepo.create({
      title: 'Training Session 1',
      description: 'First session of training series',
      startTime: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
      capacity: 50,
      organizationId: savedOrgs[0].id,
      parentEventId: savedParent.id,
      status: EventStatus.PUBLISHED,
      allowExternalAttendees: false,
    });

    const savedEvents = await eventRepo.save([...events, childEvent]);
    console.log(`Created ${savedEvents.length} events (including parent-child)`);

    // Create Resources
    console.log('Creating resources...');
    const resources = [
      resourceRepo.create({
        name: 'Conference Hall A',
        description: 'Large conference hall with AV equipment',
        type: ResourceType.EXCLUSIVE,
        organizationId: savedOrgs[0].id,
        availableQuantity: 1,
        isGlobal: false,
      }),
      resourceRepo.create({
        name: 'Projector System',
        description: 'High-definition projector',
        type: ResourceType.SHAREABLE,
        organizationId: savedOrgs[0].id,
        availableQuantity: 1,
        maxConcurrentUsage: 3,
        isGlobal: false,
      }),
      resourceRepo.create({
        name: 'Printed Materials',
        description: 'Conference handouts and brochures',
        type: ResourceType.CONSUMABLE,
        organizationId: savedOrgs[0].id,
        availableQuantity: 500,
        isGlobal: false,
      }),
      resourceRepo.create({
        name: 'Meeting Room 101',
        description: 'Small meeting room',
        type: ResourceType.EXCLUSIVE,
        organizationId: savedOrgs[1].id,
        availableQuantity: 1,
        isGlobal: false,
      }),
      resourceRepo.create({
        name: 'Global Wi-Fi Router',
        description: 'Shared Wi-Fi infrastructure',
        type: ResourceType.SHAREABLE,
        organizationId: null,
        availableQuantity: 1,
        maxConcurrentUsage: 100,
        isGlobal: true,
      }),
    ];
    const savedResources = await resourceRepo.save(resources);
    console.log(`Created ${savedResources.length} resources`);

    // Create Attendances
    console.log('Creating attendances...');
    const attendances = [
      attendanceRepo.create({
        userId: savedUsers[0].id,
        eventId: savedEvents[0].id,
      }),
      attendanceRepo.create({
        userId: savedUsers[1].id,
        eventId: savedEvents[0].id,
      }),
      attendanceRepo.create({
        userId: savedUsers[0].id,
        eventId: savedEvents[1].id,
      }),
      attendanceRepo.create({
        userEmail: 'external@example.com',
        userName: 'External Attendee',
        eventId: savedEvents[1].id,
      }),
      attendanceRepo.create({
        userId: savedUsers[2].id,
        eventId: savedEvents[2].id,
      }),
    ];
    const savedAttendances = await attendanceRepo.save(attendances);
    console.log(`Created ${savedAttendances.length} attendances`);

    // Create Resource Allocations
    console.log('Creating resource allocations...');
    const allocations = [
      allocationRepo.create({
        eventId: savedEvents[1].id,
        resourceId: savedResources[0].id, // Conference Hall A
        quantity: 1,
      }),
      allocationRepo.create({
        eventId: savedEvents[1].id,
        resourceId: savedResources[1].id, // Projector System
        quantity: 1,
      }),
      allocationRepo.create({
        eventId: savedEvents[1].id,
        resourceId: savedResources[2].id, // Printed Materials
        quantity: 100,
      }),
      allocationRepo.create({
        eventId: savedEvents[2].id,
        resourceId: savedResources[3].id, // Meeting Room 101
        quantity: 1,
      }),
    ];
    const savedAllocations = await allocationRepo.save(allocations);
    console.log(`Created ${savedAllocations.length} resource allocations`);

    console.log('\n✅ Seed data created successfully!');
    console.log(`\nSummary:`);
    console.log(`- Organizations: ${savedOrgs.length}`);
    console.log(`- Users: ${savedUsers.length}`);
    console.log(`- Events: ${savedEvents.length}`);
    console.log(`- Resources: ${savedResources.length}`);
    console.log(`- Attendances: ${savedAttendances.length}`);
    console.log(`- Resource Allocations: ${savedAllocations.length}`);

    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    await dataSource.destroy();
    process.exit(1);
  }
}

seed();
