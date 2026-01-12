import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvitesController } from './invites.controller';
import { PublicInvitesController } from './public-invites.controller';
import { InvitesService } from './invites.service';
import { Invite } from '../entities/invite.entity';
import { Event } from '../entities/event.entity';
import { User } from '../entities/user.entity';
import { Organization } from '../entities/organization.entity';
import { Attendance } from '../entities/attendance.entity';
import { AttendancesModule } from '../attendances/attendances.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invite, Event, User, Organization, Attendance]),
    AttendancesModule,
  ],
  controllers: [InvitesController, PublicInvitesController],
  providers: [InvitesService],
  exports: [InvitesService],
})
export class InvitesModule {}
