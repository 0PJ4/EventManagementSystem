import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResourcesController } from './resources.controller';
import { ResourcesService } from './resources.service';
import { Resource } from '../entities/resource.entity';
import { ResourceAllocation } from '../entities/resource-allocation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Resource, ResourceAllocation])],
  controllers: [ResourcesController],
  providers: [ResourcesService],
  exports: [ResourcesService],
})
export class ResourcesModule {}
