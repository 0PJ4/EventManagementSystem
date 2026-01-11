import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AllocationsController } from './allocations.controller';
import { AllocationsService } from './allocations.service';
import { ResourceAllocation } from '../entities/resource-allocation.entity';
import { Resource } from '../entities/resource.entity';
import { Event } from '../entities/event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ResourceAllocation, Resource, Event])],
  controllers: [AllocationsController],
  providers: [AllocationsService],
  exports: [AllocationsService],
})
export class AllocationsModule {}
