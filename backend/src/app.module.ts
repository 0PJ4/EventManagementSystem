import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { OrganizationsModule } from './organizations/organizations.module';
import { UsersModule } from './users/users.module';
import { EventsModule } from './events/events.module';
import { ResourcesModule } from './resources/resources.module';
import { AttendancesModule } from './attendances/attendances.module';
import { AllocationsModule } from './allocations/allocations.module';
import { ReportsModule } from './reports/reports.module';
import { InvitesModule } from './invites/invites.module';
import { AuthModule } from './auth/auth.module';
import { Organization } from './entities/organization.entity';
import { User } from './entities/user.entity';
import { Event } from './entities/event.entity';
import { Resource } from './entities/resource.entity';
import { Attendance } from './entities/attendance.entity';
import { ResourceAllocation } from './entities/resource-allocation.entity';
import { Invite } from './entities/invite.entity';

@Module({
  controllers: [AppController],
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'event_booking',
            entities: [Organization, User, Event, Resource, Attendance, ResourceAllocation, Invite],
      synchronize: false,
      logging: true,
    }),
    OrganizationsModule,
    UsersModule,
    EventsModule,
    ResourcesModule,
    AttendancesModule,
          AllocationsModule,
          ReportsModule,
          InvitesModule,
          AuthModule,
        ],
})
export class AppModule {}
