import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { Organization } from './entities/organization.entity';
import { User } from './entities/user.entity';
import { Event } from './entities/event.entity';
import { Resource } from './entities/resource.entity';
import { Attendance } from './entities/attendance.entity';
import { ResourceAllocation } from './entities/resource-allocation.entity';
import { Invite } from './entities/invite.entity';
import { InventoryTransaction } from './entities/inventory-transaction.entity';

config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'event_booking',
  entities: [Organization, User, Event, Resource, Attendance, ResourceAllocation, Invite, InventoryTransaction],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: true,
});
