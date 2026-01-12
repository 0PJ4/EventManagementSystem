require('dotenv').config();
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Organization } from '../entities/organization.entity';
import { User } from '../entities/user.entity';
import { Event } from '../entities/event.entity';
import { Resource } from '../entities/resource.entity';
import { Attendance } from '../entities/attendance.entity';
import { ResourceAllocation } from '../entities/resource-allocation.entity';
import { Invite } from '../entities/invite.entity';
import * as bcrypt from 'bcrypt';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'event_booking',
  entities: [Organization, User, Event, Resource, Attendance, ResourceAllocation, Invite],
  synchronize: false,
  logging: false,
});

async function seedDatabase() {
  try {
    await dataSource.initialize();
    console.log('Database connected. Starting seed...');

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    // Start transaction
    await queryRunner.startTransaction();

    try {
      // Clear existing test data
      console.log('Clearing existing test data...');
      await queryRunner.query(`DELETE FROM attendances WHERE "userId" IN (SELECT id FROM users WHERE email LIKE '%@example.com' OR email LIKE 'test_%@example.com' OR email LIKE '%@techcorp.com' OR email LIKE '%@global.com' OR email LIKE '%@digital.com' OR email LIKE '%@future.com' OR email LIKE '%@enterprise.com' OR email LIKE '%@client.com')`);
      await queryRunner.query(`DELETE FROM resource_allocations WHERE "eventId" IN (SELECT id FROM events WHERE title LIKE 'Test%' OR title LIKE '%Workshop%' OR title LIKE '%Conference%' OR title LIKE '%Seminar%' OR title LIKE '%Meeting%' OR title LIKE '%Training%' OR title LIKE '%Session%' OR title LIKE '%Summit%' OR title LIKE '%Launch%')`);
      await queryRunner.query(`DELETE FROM events WHERE title LIKE 'Test%' OR title LIKE '%Workshop%' OR title LIKE '%Conference%' OR title LIKE '%Seminar%' OR title LIKE '%Meeting%' OR title LIKE '%Training%' OR title LIKE '%Session%' OR title LIKE '%Summit%' OR title LIKE '%Launch%'`);
      await queryRunner.query(`DELETE FROM resources WHERE name LIKE 'Test%' OR name LIKE 'Conference%' OR name LIKE 'Projector%' OR name LIKE 'Laptop%' OR name LIKE 'Meeting%' OR name LIKE 'Hall%' OR name LIKE 'Room%' OR name LIKE 'Auditorium%' OR name LIKE 'Board%' OR name LIKE 'Training%' OR name LIKE 'Video%' OR name LIKE 'Audio%' OR name LIKE 'Tablet%' OR name LIKE 'Printed%' OR name LIKE 'Notebook%' OR name LIKE 'Pen%' OR name LIKE 'Catering%' OR name LIKE 'Name%'`);
      await queryRunner.query(`DELETE FROM users WHERE email LIKE '%@example.com' OR email LIKE 'test_%@example.com' OR email LIKE '%@techcorp.com' OR email LIKE '%@global.com' OR email LIKE '%@digital.com' OR email LIKE '%@future.com' OR email LIKE '%@enterprise.com'`);
      await queryRunner.query(`DELETE FROM organizations WHERE name LIKE 'Test%' OR name LIKE 'TechCorp%' OR name LIKE 'Global%' OR name LIKE 'Digital%' OR name LIKE 'Future%' OR name LIKE 'Enterprise%'`);

      // 1. Create Realistic Organizations
      console.log('Creating organizations...');
      const orgNames = ['TechCorp Solutions', 'Global Innovations', 'Digital Dynamics', 'Future Systems', 'Enterprise Solutions'];
      const orgDomains = ['techcorp.com', 'global.com', 'digital.com', 'future.com', 'enterprise.com'];
      const orgs = [];
      for (const name of orgNames) {
        const org = await queryRunner.query(`
          INSERT INTO organizations (id, name, "createdAt")
          VALUES (gen_random_uuid(), $1, NOW())
          RETURNING id, name
        `, [name]);
        orgs.push(org[0]);
      }
      const orgIds = orgs.map(o => o.id);

      // 2. Create Realistic Users - At least 10 per organization
      console.log('Creating users...');
      const hashedPassword = await bcrypt.hash('password123', 10);
      
      const firstNames = ['John', 'Sarah', 'Mike', 'Lisa', 'David', 'Emily', 'James', 'Anna', 'Robert', 'Maria', 'Thomas', 'Jennifer', 'Christopher', 'Patricia', 'Daniel', 'Linda', 'Mark', 'Susan', 'Paul', 'Karen', 'Kevin', 'Nancy', 'Steven', 'Betty', 'Andrew', 'Helen', 'Joshua', 'Sandra', 'Brian', 'Donna', 'Richard', 'Carol', 'Jason', 'Michelle', 'Ryan', 'Kimberly', 'Jeffrey', 'Deborah', 'Gary', 'Sharon', 'Nicholas', 'Laura', 'Eric', 'Amy', 'Stephen', 'Angela', 'Timothy', 'Melissa', 'Ronald', 'Brenda'];
      const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts'];
      
      const users = [];
      let userIndex = 0;
      
      // Admin user
      const admin = await queryRunner.query(`
        INSERT INTO users (id, email, name, password, role, "organizationId", "createdAt")
        VALUES (gen_random_uuid(), $1, $2, $3, 'admin', NULL, NOW())
        RETURNING id, email, name, role
      `, ['admin@system.com', 'Admin User', hashedPassword]);
      users.push(admin[0]);
      
      // Org admins (one per org)
      for (let i = 0; i < orgs.length; i++) {
        const firstName = firstNames[userIndex % firstNames.length];
        const lastName = lastNames[userIndex % lastNames.length];
        const name = `${firstName} ${lastName}`;
        const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${orgDomains[i]}`;
        const user = await queryRunner.query(`
          INSERT INTO users (id, email, name, password, role, "organizationId", "createdAt")
          VALUES (gen_random_uuid(), $1, $2, $3, 'org', $4, NOW())
          RETURNING id, email, name, role
        `, [email, name, hashedPassword, orgIds[i]]);
        users.push(user[0]);
        userIndex++;
      }
      
      // Regular users - at least 12 per organization
      for (let orgIdx = 0; orgIdx < orgs.length; orgIdx++) {
        for (let userCount = 0; userCount < 12; userCount++) {
          const firstName = firstNames[userIndex % firstNames.length];
          const lastName = lastNames[userIndex % lastNames.length];
          const name = `${firstName} ${lastName}`;
          const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${userCount > 0 ? userCount : ''}@${orgDomains[orgIdx]}`;
          const user = await queryRunner.query(`
            INSERT INTO users (id, email, name, password, role, "organizationId", "createdAt")
            VALUES (gen_random_uuid(), $1, $2, $3, 'user', $4, NOW())
            RETURNING id, email, name, role
          `, [email, name, hashedPassword, orgIds[orgIdx]]);
          users.push(user[0]);
          userIndex++;
        }
      }

      // 3. Create Many More Realistic Resources
      console.log('Creating resources...');
      const resourcesData = [
        // Exclusive resources - venues
        { name: 'Conference Hall A', description: 'Main conference hall', type: 'exclusive', orgId: orgIds[0], quantity: 1 },
        { name: 'Conference Hall B', description: 'Secondary hall', type: 'exclusive', orgId: orgIds[0], quantity: 1 },
        { name: 'Conference Hall C', description: 'Small conference hall', type: 'exclusive', orgId: orgIds[0], quantity: 1 },
        { name: 'Auditorium', description: 'Large auditorium', type: 'exclusive', orgId: orgIds[1], quantity: 1 },
        { name: 'Board Room', description: 'Executive board room', type: 'exclusive', orgId: orgIds[1], quantity: 1 },
        { name: 'Training Center', description: 'Training facility', type: 'exclusive', orgId: orgIds[1], quantity: 1 },
        { name: 'Meeting Room Alpha', description: 'Large meeting room', type: 'exclusive', orgId: orgIds[2], quantity: 1 },
        { name: 'Meeting Room Beta', description: 'Medium meeting room', type: 'exclusive', orgId: orgIds[2], quantity: 1 },
        { name: 'Seminar Hall', description: 'Seminar facility', type: 'exclusive', orgId: orgIds[3], quantity: 1 },
        { name: 'Workshop Space', description: 'Workshop area', type: 'exclusive', orgId: orgIds[3], quantity: 1 },
        { name: 'Presentation Room', description: 'Presentation facility', type: 'exclusive', orgId: orgIds[4], quantity: 1 },
        { name: 'Event Center', description: 'Main event center', type: 'exclusive', orgId: orgIds[4], quantity: 1 },
        
        // Shareable resources - equipment
        { name: 'Projector System', description: 'High-quality projector', type: 'shareable', orgId: orgIds[0], quantity: 10, maxConcurrent: 5 },
        { name: 'Video Conference Setup', description: 'Video conferencing equipment', type: 'shareable', orgId: orgIds[0], quantity: 8, maxConcurrent: 4 },
        { name: 'Audio System', description: 'Sound system', type: 'shareable', orgId: orgIds[0], quantity: 6, maxConcurrent: 3 },
        { name: 'Laptops', description: 'Presentation laptops', type: 'shareable', orgId: orgIds[1], quantity: 15, maxConcurrent: 8 },
        { name: 'Tablets', description: 'Tablets for workshops', type: 'shareable', orgId: orgIds[1], quantity: 20, maxConcurrent: 10 },
        { name: 'Microphones', description: 'Wireless microphones', type: 'shareable', orgId: orgIds[1], quantity: 12, maxConcurrent: 6 },
        { name: 'Screens', description: 'Display screens', type: 'shareable', orgId: orgIds[2], quantity: 8, maxConcurrent: 4 },
        { name: 'Cameras', description: 'Video cameras', type: 'shareable', orgId: orgIds[2], quantity: 10, maxConcurrent: 5 },
        { name: 'Sound Mixer', description: 'Audio mixing equipment', type: 'shareable', orgId: orgIds[2], quantity: 5, maxConcurrent: 3 },
        { name: 'Smart Boards', description: 'Interactive smart boards', type: 'shareable', orgId: orgIds[3], quantity: 6, maxConcurrent: 3 },
        { name: 'Printers', description: 'Printing equipment', type: 'shareable', orgId: orgIds[3], quantity: 4, maxConcurrent: 2 },
        { name: 'Whiteboards', description: 'Mobile whiteboards', type: 'shareable', orgId: orgIds[4], quantity: 15, maxConcurrent: 8 },
        { name: 'Display Monitors', description: 'Large display monitors', type: 'shareable', orgId: orgIds[4], quantity: 8, maxConcurrent: 4 },
        
        // Consumable resources - supplies
        { name: 'Printed Materials', description: 'Event brochures and handouts', type: 'consumable', orgId: orgIds[0], quantity: 500 },
        { name: 'Notebooks', description: 'Notebooks for attendees', type: 'consumable', orgId: orgIds[0], quantity: 300 },
        { name: 'Pens', description: 'Pens and writing materials', type: 'consumable', orgId: orgIds[0], quantity: 400 },
        { name: 'Name Tags', description: 'Event name tags', type: 'consumable', orgId: orgIds[0], quantity: 250 },
        { name: 'Brochures', description: 'Event brochures', type: 'consumable', orgId: orgIds[1], quantity: 350 },
        { name: 'Folders', description: 'Document folders', type: 'consumable', orgId: orgIds[1], quantity: 200 },
        { name: 'Handouts', description: 'Training handouts', type: 'consumable', orgId: orgIds[1], quantity: 450 },
        { name: 'Certificates', description: 'Completion certificates', type: 'consumable', orgId: orgIds[2], quantity: 150 },
        { name: 'Badges', description: 'Event badges', type: 'consumable', orgId: orgIds[2], quantity: 300 },
        { name: 'Programs', description: 'Event programs', type: 'consumable', orgId: orgIds[2], quantity: 280 },
        { name: 'Catering Supplies', description: 'Food and beverage supplies', type: 'consumable', orgId: orgIds[3], quantity: 200 },
        { name: 'Bottled Water', description: 'Water bottles', type: 'consumable', orgId: orgIds[3], quantity: 500 },
        { name: 'Coffee Supplies', description: 'Coffee and tea supplies', type: 'consumable', orgId: orgIds[4], quantity: 150 },
        { name: 'Snacks', description: 'Event snacks', type: 'consumable', orgId: orgIds[4], quantity: 300 },
      ];

      const resources = [];
      for (const resData of resourcesData) {
        const query = resData.type === 'shareable' 
          ? `INSERT INTO resources (id, name, description, type, "organizationId", "availableQuantity", "maxConcurrentUsage", "isGlobal", "createdAt")
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, false, NOW())
             RETURNING id, name, type`
          : `INSERT INTO resources (id, name, description, type, "organizationId", "availableQuantity", "isGlobal", "createdAt")
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, false, NOW())
             RETURNING id, name, type`;
        
        const params = resData.type === 'shareable'
          ? [resData.name, resData.description, resData.type, resData.orgId, resData.quantity, resData.maxConcurrent]
          : [resData.name, resData.description, resData.type, resData.orgId, resData.quantity];
        
        const res = await queryRunner.query(query, params);
        resources.push(res[0]);
      }

      // 4. Create Many More Realistic Events
      console.log('Creating events...');
      const now = new Date();
      const eventsData = [
        // Past events
        { title: 'Annual Company Meeting', desc: 'Company-wide annual meeting', orgId: orgIds[0], capacity: 150, daysAgo: 45, hours: 3 },
        { title: 'Product Launch Workshop', desc: 'New product launch event', orgId: orgIds[0], capacity: 100, daysAgo: 40, hours: 4 },
        { title: 'Team Building Retreat', desc: 'Team building activities', orgId: orgIds[0], capacity: 80, daysAgo: 35, hours: 6 },
        { title: 'Technical Training Session', desc: 'Technical skills training', orgId: orgIds[0], capacity: 50, daysAgo: 32, hours: 3 },
        { title: 'Leadership Conference', desc: 'Leadership development conference', orgId: orgIds[1], capacity: 200, daysAgo: 38, hours: 5 },
        { title: 'Marketing Seminar', desc: 'Marketing best practices seminar', orgId: orgIds[1], capacity: 120, daysAgo: 30, hours: 4 },
        { title: 'Sales Training', desc: 'Sales techniques training', orgId: orgIds[1], capacity: 60, daysAgo: 28, hours: 3 },
        { title: 'Customer Success Workshop', desc: 'Customer success strategies', orgId: orgIds[1], capacity: 90, daysAgo: 25, hours: 4 },
        { title: 'Developer Meetup', desc: 'Developer community meetup', orgId: orgIds[2], capacity: 75, daysAgo: 33, hours: 3 },
        { title: 'Design Workshop', desc: 'Design thinking workshop', orgId: orgIds[2], capacity: 55, daysAgo: 27, hours: 5 },
        { title: 'Finance Training', desc: 'Financial planning training', orgId: orgIds[3], capacity: 70, daysAgo: 36, hours: 4 },
        { title: 'HR Workshop', desc: 'Human resources workshop', orgId: orgIds[3], capacity: 40, daysAgo: 24, hours: 3 },
        { title: 'IT Security Seminar', desc: 'Cybersecurity awareness seminar', orgId: orgIds[4], capacity: 95, daysAgo: 42, hours: 4 },
        { title: 'Wellness Program', desc: 'Employee wellness program', orgId: orgIds[4], capacity: 110, daysAgo: 29, hours: 2 },
        { title: 'Project Management Training', desc: 'Project management skills', orgId: orgIds[0], capacity: 65, daysAgo: 26, hours: 4 },
        { title: 'Communication Skills', desc: 'Effective communication training', orgId: orgIds[1], capacity: 85, daysAgo: 31, hours: 3 },
        { title: 'Data Analysis Workshop', desc: 'Data analysis techniques', orgId: orgIds[2], capacity: 45, daysAgo: 23, hours: 4 },
        { title: 'Customer Service Training', desc: 'Customer service excellence', orgId: orgIds[3], capacity: 58, daysAgo: 37, hours: 3 },
        { title: 'Time Management Seminar', desc: 'Time management strategies', orgId: orgIds[4], capacity: 72, daysAgo: 21, hours: 2 },
        
        // Ongoing events
        { title: 'Quarterly Review Meeting', desc: 'Q4 quarterly review', orgId: orgIds[0], capacity: 100, daysAgo: -0.5, hours: 2 },
        { title: 'Weekly Standup', desc: 'Weekly team standup', orgId: orgIds[1], capacity: 75, daysAgo: -0.25, hours: 1 },
        { title: 'Client Presentation', desc: 'Client demo presentation', orgId: orgIds[2], capacity: 25, daysAgo: -0.3, hours: 1.5 },
        
        // Upcoming events
        { title: 'New Year Kickoff', desc: 'New year planning session', orgId: orgIds[0], capacity: 180, daysAgo: -5, hours: 4 },
        { title: 'Strategy Planning Session', desc: 'Annual strategy planning', orgId: orgIds[1], capacity: 60, daysAgo: -7, hours: 6 },
        { title: 'Innovation Summit', desc: 'Innovation and technology summit', orgId: orgIds[2], capacity: 250, daysAgo: -10, hours: 8 },
        { title: 'Agile Training Program', desc: 'Agile methodology training', orgId: orgIds[0], capacity: 45, daysAgo: -12, hours: 4 },
        { title: 'Customer Feedback Session', desc: 'Customer feedback gathering', orgId: orgIds[1], capacity: 85, daysAgo: -14, hours: 3 },
        { title: 'Design Thinking Workshop', desc: 'Design thinking methodology', orgId: orgIds[2], capacity: 55, daysAgo: -16, hours: 5 },
        { title: 'Finance Workshop', desc: 'Financial planning workshop', orgId: orgIds[3], capacity: 70, daysAgo: -18, hours: 4 },
        { title: 'Leadership Development', desc: 'Leadership skills development', orgId: orgIds[4], capacity: 65, daysAgo: -20, hours: 5 },
        { title: 'Product Demo Day', desc: 'Product demonstration day', orgId: orgIds[0], capacity: 120, daysAgo: -22, hours: 6 },
        { title: 'Marketing Campaign Launch', desc: 'Marketing campaign kickoff', orgId: orgIds[1], capacity: 95, daysAgo: -24, hours: 4 },
        { title: 'Technology Workshop', desc: 'Technology trends workshop', orgId: orgIds[2], capacity: 80, daysAgo: -26, hours: 4 },
        { title: 'Team Collaboration Session', desc: 'Team collaboration training', orgId: orgIds[3], capacity: 50, daysAgo: -28, hours: 3 },
        { title: 'Business Strategy Meeting', desc: 'Business strategy discussion', orgId: orgIds[4], capacity: 90, daysAgo: -30, hours: 4 },
        { title: 'Skills Development Program', desc: 'Professional skills development', orgId: orgIds[0], capacity: 75, daysAgo: -32, hours: 5 },
        { title: 'Networking Event', desc: 'Industry networking event', orgId: orgIds[1], capacity: 150, daysAgo: -34, hours: 3 },
        { title: 'Research Presentation', desc: 'Research findings presentation', orgId: orgIds[2], capacity: 60, daysAgo: -36, hours: 2 },
        { title: 'Performance Review', desc: 'Annual performance review', orgId: orgIds[3], capacity: 40, daysAgo: -38, hours: 3 },
        { title: 'Innovation Lab Session', desc: 'Innovation lab workshop', orgId: orgIds[4], capacity: 55, daysAgo: -40, hours: 4 },
        
        // Overlapping events for double-booking
        { title: 'Morning Standup', desc: 'Daily standup meeting', orgId: orgIds[0], capacity: 30, daysAgo: -3, hours: 1 },
        { title: 'Client Call', desc: 'Client consultation call', orgId: orgIds[0], capacity: 25, daysAgo: -3, hours: 1.5 },
        
        // Parent-child events
        { title: 'Annual Conference 2024', desc: 'Main annual conference', orgId: orgIds[0], capacity: 300, daysAgo: -35, hours: 8, isParent: true },
      ];

      const events = [];
      let parentEventId: string | null = null;
      
      for (const eventData of eventsData) {
        const startTime = new Date(now.getTime() + eventData.daysAgo * 24 * 60 * 60 * 1000);
        const endTime = new Date(startTime.getTime() + eventData.hours * 60 * 60 * 1000);
        
        if (eventData.isParent) {
          const event = await queryRunner.query(`
            INSERT INTO events (id, title, description, "startTime", "endTime", capacity, status, "allowExternalAttendees", "organizationId", "createdAt")
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'published', true, $6, NOW())
            RETURNING id, title
          `, [eventData.title, eventData.desc, startTime, endTime, eventData.capacity, eventData.orgId]);
          events.push(event[0]);
          parentEventId = event[0].id;
          
          // Create child events
          const childEvents = [
            { title: 'Keynote Session', capacity: 300, startOffset: 1, hours: 2 },
            { title: 'Breakout Session A', capacity: 80, startOffset: 4, hours: 1.5 },
            { title: 'Breakout Session B', capacity: 75, startOffset: 4, hours: 1.5 },
            { title: 'Closing Session', capacity: 300, startOffset: 6.5, hours: 1 },
          ];
          
          for (const child of childEvents) {
            const childStart = new Date(startTime.getTime() + child.startOffset * 60 * 60 * 1000);
            const childEnd = new Date(childStart.getTime() + child.hours * 60 * 60 * 1000);
            const childEvent = await queryRunner.query(`
              INSERT INTO events (id, title, description, "startTime", "endTime", capacity, status, "allowExternalAttendees", "organizationId", "parentEventId", "createdAt")
              VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'published', true, $6, $7, NOW())
              RETURNING id, title
            `, [child.title, 'Conference session', childStart, childEnd, child.capacity, eventData.orgId, parentEventId]);
            events.push(childEvent[0]);
          }
        } else {
          const event = await queryRunner.query(`
            INSERT INTO events (id, title, description, "startTime", "endTime", capacity, status, "allowExternalAttendees", "organizationId", "createdAt")
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'published', true, $6, NOW())
            RETURNING id, title
          `, [eventData.title, eventData.desc, startTime, endTime, eventData.capacity, eventData.orgId]);
          events.push(event[0]);
        }
      }

      // 5. Create Attendances with realistic patterns
      console.log('Creating attendances...');
      
      // Past events attendance patterns (different show-up rates)
      const pastEvents = events.filter((e, idx) => idx < 19);
      const attendancePatterns = [
        { total: 135, checkedIn: 122, external: 12 }, // 90% show-up
        { total: 92, checkedIn: 78, external: 8 },   // 85% show-up
        { total: 68, checkedIn: 54, external: 5 },   // 80% show-up
        { total: 42, checkedIn: 38, external: 3 },   // 90% show-up
        { total: 175, checkedIn: 140, external: 15 }, // 80% show-up
        { total: 108, checkedIn: 95, external: 10 },  // 88% show-up
        { total: 51, checkedIn: 43, external: 4 },    // 84% show-up
        { total: 82, checkedIn: 70, external: 7 },    // 85% show-up
        { total: 66, checkedIn: 56, external: 6 },    // 85% show-up
        { total: 48, checkedIn: 42, external: 4 },    // 88% show-up
        { total: 58, checkedIn: 49, external: 5 },    // 85% show-up
        { total: 32, checkedIn: 28, external: 3 },    // 88% show-up
        { total: 82, checkedIn: 70, external: 8 },    // 85% show-up
        { total: 95, checkedIn: 81, external: 9 },    // 85% show-up
        { total: 55, checkedIn: 47, external: 5 },    // 85% show-up
        { total: 72, checkedIn: 62, external: 6 },    // 86% show-up
        { total: 38, checkedIn: 33, external: 3 },    // 87% show-up
        { total: 50, checkedIn: 43, external: 4 },    // 86% show-up
        { total: 64, checkedIn: 55, external: 6 },    // 86% show-up
      ];

      for (let i = 0; i < pastEvents.length && i < attendancePatterns.length; i++) {
        const event = pastEvents[i];
        const pattern = attendancePatterns[i];
        
        // Get event start time
        const eventDetails = await queryRunner.query(`
          SELECT "startTime" FROM events WHERE id = $1
        `, [event.id]);
        const eventStartTime = eventDetails[0]?.startTime ? new Date(eventDetails[0].startTime) : new Date(now.getTime() - (45 - i * 2) * 24 * 60 * 60 * 1000);

        // Create user attendances
        const usedUserIds = new Set<string>();
        for (let j = 0; j < pattern.total - pattern.external; j++) {
          let userId = users[j % users.length].id;
          let attempts = 0;
          while (usedUserIds.has(userId) && attempts < users.length * 2) {
            userId = users[(j + attempts) % users.length].id;
            attempts++;
          }
          
          const existing = await queryRunner.query(`
            SELECT id FROM attendances WHERE "eventId" = $1 AND "userId" = $2
          `, [event.id, userId]);
          
          if (existing.length === 0) {
            const checkedIn = j < pattern.checkedIn;
            const checkedInAt = checkedIn ? eventStartTime : null;
            
            await queryRunner.query(`
              INSERT INTO attendances (id, "userId", "eventId", "checkedInAt", "registeredAt")
              VALUES (gen_random_uuid(), $1, $2, $3, $4)
            `, [userId, event.id, checkedInAt, new Date(eventStartTime.getTime() - (2 + j % 3) * 24 * 60 * 60 * 1000)]);
            usedUserIds.add(userId);
          }
        }

        // Create external attendances
        for (let j = 0; j < pattern.external; j++) {
          await queryRunner.query(`
            INSERT INTO attendances (id, "userId", "eventId", "userEmail", "userName", "registeredAt")
            VALUES (gen_random_uuid(), NULL, $1, $2, $3, $4)
          `, [event.id, `client${j}@external.com`, `External Attendee ${j + 1}`, new Date(eventStartTime.getTime() - 1 * 24 * 60 * 60 * 1000)]);
        }
      }

      // Ongoing events
      for (let i = 19; i < 22 && i < events.length; i++) {
        const event = events[i];
        const patterns = [{ total: 85, checkedIn: 65 }, { total: 58, checkedIn: 42 }, { total: 22, checkedIn: 18 }];
        const pattern = patterns[i - 19];
        
        const usedUserIds = new Set<string>();
        for (let j = 0; j < pattern.total; j++) {
          let userId = users[j % users.length].id;
          let attempts = 0;
          while (usedUserIds.has(userId) && attempts < users.length * 2) {
            userId = users[(j + attempts) % users.length].id;
            attempts++;
          }
          
          const existing = await queryRunner.query(`
            SELECT id FROM attendances WHERE "eventId" = $1 AND "userId" = $2
          `, [event.id, userId]);
          
          if (existing.length === 0) {
            const checkedIn = j < pattern.checkedIn;
            const checkedInAt = checkedIn ? new Date(now.getTime() - 30 * 60 * 1000) : null;
            
            await queryRunner.query(`
              INSERT INTO attendances (id, "userId", "eventId", "checkedInAt", "registeredAt")
              VALUES (gen_random_uuid(), $1, $2, $3, $4)
            `, [userId, event.id, checkedInAt, new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)]);
            usedUserIds.add(userId);
          }
        }
      }

      // Upcoming events (no check-ins yet)
      for (let i = 22; i < events.length; i++) {
        const event = events[i];
        const attendanceCounts = [155, 48, 220, 38, 72, 42, 58, 65, 120, 82, 70, 50, 68, 130, 58, 140, 55, 48, 40, 50];
        const count = attendanceCounts[i - 22] || 60;
        
        const usedUserIds = new Set<string>();
        for (let j = 0; j < count; j++) {
          let userId = users[j % users.length].id;
          let attempts = 0;
          while (usedUserIds.has(userId) && attempts < users.length * 2) {
            userId = users[(j + attempts) % users.length].id;
            attempts++;
          }
          
          const existing = await queryRunner.query(`
            SELECT id FROM attendances WHERE "eventId" = $1 AND "userId" = $2
          `, [event.id, userId]);
          
          if (existing.length === 0) {
            await queryRunner.query(`
              INSERT INTO attendances (id, "userId", "eventId", "registeredAt")
              VALUES (gen_random_uuid(), $1, $2, $3)
            `, [userId, event.id, new Date(now.getTime() - (j % 7) * 24 * 60 * 60 * 1000)]);
            usedUserIds.add(userId);
          }
        }
      }

      // Double-booking scenario
      const user1 = users[5]; // Emily Johnson
      if (events.length > 43) {
        await queryRunner.query(`
          INSERT INTO attendances (id, "userId", "eventId", "registeredAt")
          VALUES (gen_random_uuid(), $1, $2, NOW())
          ON CONFLICT DO NOTHING
        `, [user1.id, events[43].id]);
        await queryRunner.query(`
          INSERT INTO attendances (id, "userId", "eventId", "registeredAt")
          VALUES (gen_random_uuid(), $1, $2, NOW())
          ON CONFLICT DO NOTHING
        `, [user1.id, events[44].id]);
      }

      // 6. Create Many Resource Allocations
      console.log('Creating resource allocations...');

      // Allocate resources to events
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        
        // Allocate 2-4 resources per event
        const numResources = 2 + (i % 3);
        for (let r = 0; r < numResources; r++) {
          const resource = resources[(i * numResources + r) % resources.length];
          const quantity = resource.type === 'exclusive' ? 1 : resource.type === 'shareable' ? Math.floor((r % 3) + 2) : Math.floor((r % 5) + 5);
          
          await queryRunner.query(`
            INSERT INTO resource_allocations (id, "eventId", "resourceId", quantity, "allocatedAt")
            VALUES (gen_random_uuid(), $1, $2, $3, NOW())
            ON CONFLICT DO NOTHING
          `, [event.id, resource.id, quantity]);
        }
      }

      // Some overlapping allocations for violations
      const exclusiveRes = resources.find(r => r.name === 'Conference Hall A');
      if (exclusiveRes && events.length > 43) {
        await queryRunner.query(`
          INSERT INTO resource_allocations (id, "eventId", "resourceId", quantity, "allocatedAt")
          VALUES (gen_random_uuid(), $1, $2, 1, NOW())
          ON CONFLICT DO NOTHING
        `, [events[43].id, exclusiveRes.id]);
        await queryRunner.query(`
          INSERT INTO resource_allocations (id, "eventId", "resourceId", quantity, "allocatedAt")
          VALUES (gen_random_uuid(), $1, $2, 1, NOW())
          ON CONFLICT DO NOTHING
        `, [events[44].id, exclusiveRes.id]);
      }

      // Shareable over-allocation
      const shareableRes = resources.find(r => r.name === 'Projector System');
      if (shareableRes && events.length > 20) {
        await queryRunner.query(`
          INSERT INTO resource_allocations (id, "eventId", "resourceId", quantity, "allocatedAt")
          VALUES (gen_random_uuid(), $1, $2, 6, NOW())
          ON CONFLICT DO NOTHING
        `, [events[20].id, shareableRes.id]);
      }

      // Commit transaction
      await queryRunner.commitTransaction();
      console.log('✅ Seed completed successfully!');
      console.log(`Created:`);
      console.log(`- ${orgs.length} organizations`);
      console.log(`- ${users.length} users (${users.filter(u => u.role === 'user').length} regular users)`);
      console.log(`- ${resources.length} resources`);
      console.log(`- ${events.length} events`);
      console.log(`- Multiple attendances with realistic patterns`);
      console.log(`- Resource allocations distributed across events`);

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
      await dataSource.destroy();
    }
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

// Run the seeder
seedDatabase();
