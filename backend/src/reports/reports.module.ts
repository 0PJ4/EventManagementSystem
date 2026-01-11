import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Event } from '../entities/event.entity';
import { Attendance } from '../entities/attendance.entity';
import { ResourceAllocation } from '../entities/resource-allocation.entity';
import { Resource } from '../entities/resource.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Event, Attendance, ResourceAllocation, Resource])],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
