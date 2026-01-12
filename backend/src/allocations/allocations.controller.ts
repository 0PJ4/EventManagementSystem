import { Controller, Get, Post, Body, Param, Delete, Patch, Query, UseGuards } from '@nestjs/common';
import { AllocationsService } from './allocations.service';
import { CreateAllocationDto } from './dto/create-allocation.dto';
import { UpdateAllocationDto } from './dto/update-allocation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';

@Controller('allocations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.ORG)
export class AllocationsController {
  constructor(private readonly allocationsService: AllocationsService) {}

  @Post()
  allocate(@Body() createAllocationDto: CreateAllocationDto) {
    return this.allocationsService.allocate(createAllocationDto);
  }

  @Get()
  findAll(
    @Query('eventId') eventId?: string,
    @Query('resourceId') resourceId?: string,
    @Query('search') search?: string,
  ) {
    return this.allocationsService.findAll(eventId, resourceId, search);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAllocationDto: UpdateAllocationDto) {
    return this.allocationsService.update(id, updateAllocationDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.allocationsService.remove(id);
  }
}
