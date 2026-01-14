require('dotenv').config();
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Organization } from './entities/organization.entity';
import { User, UserRole } from './entities/user.entity';
import { Event, EventStatus } from './entities/event.entity';
import { Resource, ResourceType } from './entities/resource.entity';
import { Attendance } from './entities/attendance.entity';
import { ResourceAllocation } from './entities/resource-allocation.entity';
import { InventoryTransaction, TransactionType } from './entities/inventory-transaction.entity';
import { Invite } from './entities/invite.entity';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'event_booking',
  entities: [Organization, User, Event, Resource, Attendance, ResourceAllocation, InventoryTransaction, Invite],
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
    const transactionRepo = dataSource.getRepository(InventoryTransaction);
    const inviteRepo = dataSource.getRepository(Invite);
    const eventRepoForDates = dataSource.getRepository(Event);

    // Clear existing data
    console.log('Clearing existing data...');
    await inviteRepo.createQueryBuilder().delete().execute();
    await transactionRepo.createQueryBuilder().delete().execute();
    await allocationRepo.createQueryBuilder().delete().execute();
    await attendanceRepo.createQueryBuilder().delete().execute();
    await eventRepo.createQueryBuilder().delete().execute();
    await resourceRepo.createQueryBuilder().delete().execute();
    await userRepo.createQueryBuilder().delete().execute();
    await orgRepo.createQueryBuilder().delete().execute();

    // Hash password function
    const hashPassword = async (password: string): Promise<string> => {
      return await bcrypt.hash(password, 10);
    };
    const defaultPassword = 'password123';
    const hashedPassword = await hashPassword(defaultPassword);

    // Create Organizations (10 orgs, 8 with domains)
    console.log('Creating organizations...');
    const orgData = [
      { name: 'Tech Corp', emailTemplate: '@techcorp.com' },
      { name: 'Sales Inc', emailTemplate: '@salesinc.com' },
      { name: 'Design Studio', emailTemplate: '@designstudio.com' },
      { name: 'Marketing Agency', emailTemplate: '@marketing.com' },
      { name: 'Finance Group', emailTemplate: '@financegroup.com' },
      { name: 'Health Services', emailTemplate: '@health.com' },
      { name: 'Education Hub', emailTemplate: '@education.com' },
      { name: 'Retail Store', emailTemplate: '@retail.com' },
      { name: 'Legal Firm', emailTemplate: null },
      { name: 'Consulting Co', emailTemplate: null },
    ];
    const orgs = orgData.map(data => orgRepo.create(data));
    const savedOrgs = await orgRepo.save(orgs);
    console.log(`Created ${savedOrgs.length} organizations`);

    // Create Admin User
    console.log('Creating admin user...');
    const admin = userRepo.create({
      name: 'Admin User',
      email: 'admin@system.com',
      password: hashedPassword,
      role: UserRole.ADMIN,
      organizationId: null,
    });
    const savedAdmin = await userRepo.save(admin);
    console.log('Created admin user');

    // Create Org Admins (10, one per org)
    console.log('Creating org admins...');
    const orgAdmins = savedOrgs.map((org, index) => {
      const domain = org.emailTemplate || `@${org.name.toLowerCase().replace(/\s+/g, '')}.com`;
      return userRepo.create({
        name: `${org.name} Admin`,
        email: `admin${domain}`,
        password: hashedPassword,
        role: UserRole.ORG,
        organizationId: org.id,
      });
    });
    const savedOrgAdmins = await userRepo.save(orgAdmins);
    console.log(`Created ${savedOrgAdmins.length} org admins`);

    // Create Members for each org (20 per org, with password for one per org)
    console.log('Creating members...');
    const allMembers: User[] = [];
    const memberCredentials: Array<{ org: string; email: string; password: string }> = [];

    for (let i = 0; i < savedOrgs.length; i++) {
      const org = savedOrgs[i];
      // Use org-specific domain or create unique domain based on org name
      const domain = org.emailTemplate || `@${org.name.toLowerCase().replace(/\s+/g, '')}.com`;
      const orgMembers: User[] = [];

      for (let j = 1; j <= 20; j++) {
        const email = `user${j}${domain}`;
        const member = userRepo.create({
          name: `User ${j} ${org.name}`,
          email: email,
          password: hashedPassword,
          role: UserRole.USER,
          organizationId: org.id,
        });
        orgMembers.push(member);

        // Save credentials for first member of each org
        if (j === 1) {
          memberCredentials.push({
            org: org.name,
            email: email,
            password: defaultPassword,
          });
        }
      }
      allMembers.push(...orgMembers);
    }
    const savedMembers = await userRepo.save(allMembers);
    console.log(`Created ${savedMembers.length} members (20 per org)`);

    // Create External Users (30 users with no organization)
    console.log('Creating external users...');
    const externalUsers = [];
    for (let i = 1; i <= 30; i++) {
      externalUsers.push(
        userRepo.create({
          name: `External User ${i}`,
          email: `external${i}@external.com`,
          password: hashedPassword,
          role: UserRole.USER,
          organizationId: null,
        })
      );
    }
    const savedExternalUsers = await userRepo.save(externalUsers);
    console.log(`Created ${savedExternalUsers.length} external users`);

    // Create Events for testing scenarios with diverse data for graphs
    console.log('Creating events...');
    const now = new Date();
    const events = [];
    
    // Create some events for each org with diverse patterns
    for (let i = 0; i < savedOrgs.length; i++) {
      const org = savedOrgs[i];
      const orgMembers = savedMembers.filter(m => m.organizationId === org.id);
      
      // Published event tomorrow (overlapping events for double-booking)
      events.push(
        eventRepo.create({
          title: `${org.name} Team Meeting`,
          description: `Weekly team meeting for ${org.name}`,
          startTime: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          endTime: new Date(now.getTime() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
          capacity: 25,
          organizationId: org.id,
          status: EventStatus.PUBLISHED,
          allowExternalAttendees: i % 2 === 0,
        })
      );

      // Published event next week (overlapping with above for some orgs)
      if (i % 3 === 0) {
        events.push(
          eventRepo.create({
            title: `${org.name} Training Session`,
            description: `Training session for ${org.name}`,
            startTime: new Date(now.getTime() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000), // 30 min overlap
            endTime: new Date(now.getTime() + 24 * 60 * 60 * 1000 + 90 * 60 * 1000),
            capacity: 30,
            organizationId: org.id,
            status: EventStatus.PUBLISHED,
            allowExternalAttendees: true,
          })
        );
      }

      // Published event next week
      events.push(
        eventRepo.create({
          title: `${org.name} Conference`,
          description: `Annual conference for ${org.name}`,
          startTime: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          endTime: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
          capacity: 100,
          organizationId: org.id,
          status: EventStatus.PUBLISHED,
          allowExternalAttendees: true,
        })
      );

      // Past event (2 weeks ago) for show-up rate graphs
      const pastEvent = eventRepo.create({
        title: `${org.name} Monthly Review`,
        description: `Monthly review meeting for ${org.name}`,
        startTime: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
        endTime: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        capacity: 40,
        organizationId: org.id,
        status: EventStatus.PUBLISHED,
        allowExternalAttendees: i % 2 === 0,
      });
      events.push(pastEvent);

      // Past event (4 weeks ago) for show-up rate graphs
      const olderPastEvent = eventRepo.create({
        title: `${org.name} Quarterly Meeting`,
        description: `Quarterly meeting for ${org.name}`,
        startTime: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000),
        endTime: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
        capacity: 60,
        organizationId: org.id,
        status: EventStatus.PUBLISHED,
        allowExternalAttendees: true,
      });
      events.push(olderPastEvent);

      // Future events (1 month, 2 months, 3 months out) for time-based analysis
      events.push(
        eventRepo.create({
          title: `${org.name} Workshop`,
          description: `Upcoming workshop for ${org.name}`,
          startTime: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          endTime: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
          capacity: 50,
          organizationId: org.id,
          status: EventStatus.PUBLISHED,
          allowExternalAttendees: true,
        })
      );

      if (i < 7) {
        events.push(
          eventRepo.create({
            title: `${org.name} Networking Event`,
            description: `Networking event for ${org.name}`,
            startTime: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
            endTime: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
            capacity: 80,
            organizationId: org.id,
            status: EventStatus.PUBLISHED,
            allowExternalAttendees: true,
          })
        );
      }

      if (i < 5) {
        events.push(
          eventRepo.create({
            title: `${org.name} Annual Summit`,
            description: `Annual summit for ${org.name}`,
            startTime: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
            endTime: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000),
            capacity: 150,
            organizationId: org.id,
            status: EventStatus.PUBLISHED,
            allowExternalAttendees: true,
          })
        );
      }

      // Draft event
      if (i < 5) {
        events.push(
          eventRepo.create({
            title: `${org.name} Planning Session`,
            description: `Planning session for ${org.name}`,
            startTime: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
            endTime: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
            capacity: 50,
            organizationId: org.id,
            status: EventStatus.DRAFT,
            allowExternalAttendees: false,
          })
        );
      }

      // Cancelled event for status diversity
      if (i < 3) {
        events.push(
          eventRepo.create({
            title: `${org.name} Cancelled Event`,
            description: `Cancelled event for ${org.name}`,
            startTime: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
            endTime: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
            capacity: 35,
            organizationId: org.id,
            status: EventStatus.CANCELLED,
            allowExternalAttendees: false,
          })
        );
      }
    }

    const savedEvents = await eventRepo.save(events);
    console.log(`Created ${savedEvents.length} events`);

    // Create parent-child event relationships (for parent-child violation reports)
    const parentEvents = savedEvents.filter(e => 
      e.title.includes('Conference') || e.title.includes('Annual Summit')
    );
    const childEvents = savedEvents.filter(e => 
      (e.title.includes('Workshop') || e.title.includes('Networking')) && 
      e.status === EventStatus.PUBLISHED
    );

    for (let i = 0; i < Math.min(parentEvents.length, childEvents.length); i++) {
      const parent = parentEvents[i];
      const child = childEvents[i];
      // Only set parent if child is within parent's time boundaries
      if (child.startTime >= parent.startTime && child.endTime <= parent.endTime) {
        child.parentEventId = parent.id;
      }
    }
    if (parentEvents.length > 0 && childEvents.length > 0) {
      await eventRepo.save(childEvents.filter(e => e.parentEventId));
      console.log(`Created ${childEvents.filter(e => e.parentEventId).length} parent-child relationships`);
    }

    // Create Resources
    console.log('Creating resources...');
    const resources = [];
    
    for (let i = 0; i < savedOrgs.length; i++) {
      const org = savedOrgs[i];
      
      // Exclusive resource
      resources.push(
        resourceRepo.create({
          name: `${org.name} Conference Room`,
          description: `Main conference room for ${org.name}`,
          type: ResourceType.EXCLUSIVE,
          organizationId: org.id,
          availableQuantity: 1,
          isGlobal: false,
        })
      );

      // Shareable resource
      resources.push(
        resourceRepo.create({
          name: `${org.name} Projector`,
          description: `High-definition projector for ${org.name}`,
          type: ResourceType.SHAREABLE,
          organizationId: org.id,
          availableQuantity: 5,
          maxConcurrentUsage: 3,
          isGlobal: false,
        })
      );

      // Consumable resource - vary by org for realism
      const consumableResources = [
        { name: 'Printed Handouts', description: 'Conference handouts and materials', quantity: 500 },
        { name: 'Notepads', description: 'Branded notepads for events', quantity: 300 },
        { name: 'Coffee Supplies', description: 'Coffee, tea, and creamer', quantity: 200 },
        { name: 'Snack Packs', description: 'Individual snack packages', quantity: 400 },
        { name: 'Welcome Kits', description: 'Event welcome packages', quantity: 250 },
        { name: 'Certificates', description: 'Training completion certificates', quantity: 150 },
        { name: 'Event Badges', description: 'Name badges and lanyards', quantity: 500 },
        { name: 'Marketing Materials', description: 'Brochures and flyers', quantity: 600 },
        { name: 'Meal Vouchers', description: 'Catering vouchers for attendees', quantity: 100 },
        { name: 'USB Drives', description: 'Pre-loaded USB drives with materials', quantity: 50 },
      ];
      const consumableIndex = i % consumableResources.length;
      const consumableData = consumableResources[consumableIndex];
      const consumable = resourceRepo.create({
        name: consumableData.name,
        description: consumableData.description,
        type: ResourceType.CONSUMABLE,
        organizationId: org.id,
        availableQuantity: consumableData.quantity,
        isGlobal: false,
      });
      // Initialize cachedCurrentStock for consumable
      consumable.cachedCurrentStock = consumableData.quantity;
      resources.push(consumable);
    }

    // Global resources (available to all organizations)
    resources.push(
      resourceRepo.create({
        name: 'Building Wi-Fi Network',
        description: 'Shared Wi-Fi infrastructure for all events',
        type: ResourceType.SHAREABLE,
        organizationId: null,
        availableQuantity: 1,
        maxConcurrentUsage: 200,
        isGlobal: true,
      })
    );

    resources.push(
      resourceRepo.create({
        name: 'Grand Ballroom',
        description: 'Large ballroom available to all organizations',
        type: ResourceType.EXCLUSIVE,
        organizationId: null,
        availableQuantity: 1,
        isGlobal: true,
      })
    );

    resources.push(
      resourceRepo.create({
        name: 'Parking Spaces',
        description: 'Event parking spaces',
        type: ResourceType.SHAREABLE,
        organizationId: null,
        availableQuantity: 50,
        maxConcurrentUsage: 50,
        isGlobal: true,
      })
    );

    const savedResources = await resourceRepo.save(resources);
    console.log(`Created ${savedResources.length} resources`);

    // Create Attendances
    console.log('Creating attendances...');
    const attendances = [];
    
    // Add some members to events
    for (let i = 0; i < savedEvents.length; i++) {
      const event = savedEvents[i];
      if (event.status === EventStatus.PUBLISHED) {
        const orgMembers = savedMembers.filter(m => m.organizationId === event.organizationId);
        const membersToAdd = orgMembers.slice(0, Math.min(5, orgMembers.length));
        
        for (const member of membersToAdd) {
          attendances.push(
            attendanceRepo.create({
              userId: member.id,
              eventId: event.id,
            })
          );
        }

      }
    }

    // Register all external users to events that allow external attendees
    const eventsWithExternalAccess = savedEvents.filter(e => 
      e.status === EventStatus.PUBLISHED && e.allowExternalAttendees
    );
    
    if (eventsWithExternalAccess.length > 0 && savedExternalUsers.length > 0) {
      // Distribute external users across events (2-3 users per event on average)
      const usersPerEvent = Math.ceil(savedExternalUsers.length / eventsWithExternalAccess.length);
      
      for (let i = 0; i < savedExternalUsers.length; i++) {
        const eventIndex = Math.floor(i / usersPerEvent) % eventsWithExternalAccess.length;
        const event = eventsWithExternalAccess[eventIndex];
        
        // Check event capacity before adding
        const currentAttendees = attendances.filter(a => a.eventId === event.id).length;
        if (event.capacity === 0 || currentAttendees < event.capacity) {
          attendances.push(
            attendanceRepo.create({
              userId: savedExternalUsers[i].id,
              eventId: event.id,
            })
          );
        }
      }
    }

    const savedAttendances = await attendanceRepo.save(attendances);
    console.log(`Created ${savedAttendances.length} attendances`);

    // Add checked-in attendees for past events (for show-up rate graphs)
    const pastEvents = savedEvents.filter(e => 
      e.status === EventStatus.PUBLISHED && 
      new Date(e.startTime) < now
    );
    
    for (const event of pastEvents) {
      const eventAttendances = savedAttendances.filter(a => a.eventId === event.id);
      // Check in 60-80% of attendees for past events
      const checkInCount = Math.floor(eventAttendances.length * (0.6 + Math.random() * 0.2));
      const attendeesToCheckIn = eventAttendances.slice(0, checkInCount);
      
      for (const attendance of attendeesToCheckIn) {
        // Set checkedInAt to event start time (simulating check-in at event start)
        attendance.checkedInAt = new Date(event.startTime);
      }
    }
    
    if (pastEvents.length > 0) {
      await attendanceRepo.save(savedAttendances.filter(a => a.checkedInAt));
      console.log(`Added checked-in attendees for ${pastEvents.length} past events`);
    }

    // Create Resource Allocations (for resource utilization graphs)
    console.log('Creating resource allocations...');
    const allocations = [];
    
    // Allocate resources to many events for better graph data
    // Process published events to ensure good resource utilization data
    const publishedEvents = savedEvents.filter(e => e.status === EventStatus.PUBLISHED);
    
    for (let i = 0; i < publishedEvents.length; i++) {
      const event = publishedEvents[i];
      const orgResources = savedResources.filter(r => r.organizationId === event.organizationId);
      const globalResources = savedResources.filter(r => r.isGlobal);
      
      if (orgResources.length > 0 || globalResources.length > 0) {
        // Allocate exclusive resource (org-specific or global)
        const exclusiveResource = orgResources.find(r => r.type === ResourceType.EXCLUSIVE) ||
                                  globalResources.find(r => r.type === ResourceType.EXCLUSIVE);
        if (exclusiveResource) {
          allocations.push(
            allocationRepo.create({
              eventId: event.id,
              resourceId: exclusiveResource.id,
              quantity: 1,
            })
          );
        }

        // Allocate shareable resource for some events
        if (i % 3 === 0) {
          const shareableResource = orgResources.find(r => r.type === ResourceType.SHAREABLE) ||
                                    globalResources.find(r => r.type === ResourceType.SHAREABLE);
          if (shareableResource) {
            allocations.push(
              allocationRepo.create({
                eventId: event.id,
                resourceId: shareableResource.id,
                quantity: Math.min(2, shareableResource.availableQuantity || 2),
              })
            );
          }
        }

        // Allocate consumable resource for most events (vary quantities for better graphs)
        if (i % 2 === 0) {
          const consumableResource = orgResources.find(r => r.type === ResourceType.CONSUMABLE);
          if (consumableResource) {
            // Vary quantities: 30, 50, 75, 100 to show different usage patterns
            const quantities = [30, 50, 75, 100];
            const quantity = quantities[i % quantities.length];
            allocations.push(
              allocationRepo.create({
                eventId: event.id,
                resourceId: consumableResource.id,
                quantity: quantity,
              })
            );
          }
        }
      }
    }

    const savedAllocations = await allocationRepo.save(allocations);
    console.log(`Created ${savedAllocations.length} resource allocations`);

    // Create inventory transactions for consumable resources
    // IMPORTANT: Since getCurrentBalance() calculates from transactions (SUM),
    // we MUST create RESTOCK transactions first to initialize stock, then ALLOCATION transactions
    console.log('Creating inventory transactions for consumable resources...');
    const inventoryTransactions = [];
    
    // First, create RESTOCK transactions for all consumable resources to initialize stock
    const consumableResources = savedResources.filter(r => r.type === ResourceType.CONSUMABLE);
    
    for (const resource of consumableResources) {
      // Create initial RESTOCK transaction (positive quantity = adding inventory)
      const restockTransaction = transactionRepo.create({
        resourceId: resource.id,
        quantity: resource.availableQuantity, // Positive quantity for restock
        type: TransactionType.RESTOCK,
        transactionDate: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), // 90 days ago (before any allocations)
        relatedEventId: null,
        notes: `Initial stock for ${resource.name}`,
        createdBy: null,
      });
      inventoryTransactions.push(restockTransaction);
    }
    
    // Then, create ALLOCATION transactions for consumable allocations (negative quantities)
    for (const allocation of savedAllocations) {
      const resource = savedResources.find(r => r.id === allocation.resourceId);
      if (resource && resource.type === ResourceType.CONSUMABLE) {
        const event = savedEvents.find(e => e.id === allocation.eventId);
        if (event) {
          // Create allocation transaction (negative quantity = consumption)
          const allocationTransaction = transactionRepo.create({
            resourceId: resource.id,
            quantity: -allocation.quantity, // Negative quantity for allocation
            type: TransactionType.ALLOCATION,
            transactionDate: event.startTime,
            relatedEventId: event.id,
            notes: `Seed data allocation for event ${event.id}`,
            createdBy: null,
          });
          inventoryTransactions.push(allocationTransaction);
        }
      }
    }

    if (inventoryTransactions.length > 0) {
      // Save all transactions (restocks first, then allocations)
      await transactionRepo.save(inventoryTransactions);
      console.log(`Created ${inventoryTransactions.length} inventory transactions (${consumableResources.length} restocks + ${inventoryTransactions.length - consumableResources.length} allocations)`);

      // Update cachedCurrentStock for consumable resources based on transaction balance
      for (const resource of consumableResources) {
        // Calculate final stock: initial restock - allocations
        const allocationsForResource = savedAllocations.filter(a => a.resourceId === resource.id);
        const totalAllocated = allocationsForResource.reduce((sum, a) => sum + a.quantity, 0);
        const finalStock = resource.availableQuantity - totalAllocated;
        
        await resourceRepo
          .createQueryBuilder()
          .update(Resource)
          .set({ cachedCurrentStock: finalStock })
          .where('id = :id', { id: resource.id })
          .execute();
      }
      console.log(`Updated cachedCurrentStock for ${consumableResources.length} consumable resources`);
    }

    // Print credentials summary
    console.log('\n✅ Seed data created successfully!');
    console.log('\n=== CREDENTIALS SUMMARY ===\n');
    console.log('ADMIN:');
    console.log(`  Email: ${savedAdmin.email}`);
    console.log(`  Password: ${defaultPassword}\n`);
    
    console.log('ORG ADMINS (first 2):');
    for (let i = 0; i < Math.min(2, savedOrgAdmins.length); i++) {
      console.log(`  ${savedOrgs[i].name}:`);
      console.log(`    Email: ${savedOrgAdmins[i].email}`);
      console.log(`    Password: ${defaultPassword}`);
    }
    console.log('\n  (All org admins use the same password: ' + defaultPassword + ')\n');
    
    console.log('MEMBER USERS (one per org):');
    memberCredentials.forEach(cred => {
      console.log(`  ${cred.org}:`);
      console.log(`    Email: ${cred.email}`);
      console.log(`    Password: ${cred.password}`);
    });
    console.log('\n  (All members use the same password: ' + defaultPassword + ')\n');
    
    console.log('EXTERNAL USERS:');
    console.log(`  Email: ${savedExternalUsers[0].email}`);
    console.log(`  Password: ${defaultPassword}`);
    console.log(`  (All ${savedExternalUsers.length} external users use the same password: ${defaultPassword})\n`);

    console.log('\n=== SUMMARY ===');
    console.log(`- Organizations: ${savedOrgs.length} (${orgData.filter(o => o.emailTemplate).length} with domains)`);
    console.log(`- Admin Users: 1`);
    console.log(`- Org Admin Users: ${savedOrgAdmins.length}`);
    console.log(`- Member Users: ${savedMembers.length}`);
    console.log(`- External Users: ${savedExternalUsers.length}`);
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
