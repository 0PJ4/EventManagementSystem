import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AllocationsController } from './allocations.controller';
import { AllocationsService } from './allocations.service';
import { ResourceAllocation } from '../entities/resource-allocation.entity';
import { Resource } from '../entities/resource.entity';
import { Event } from '../entities/event.entity';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ResourceAllocation, Resource, Event]),
    forwardRef(() => InventoryModule),
  ],
  controllers: [AllocationsController],
  providers: [AllocationsService],
  exports: [AllocationsService],
})
export class AllocationsModule {}
