import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.ORG)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('double-booked-users')
  getDoubleBookedUsers() {
    return this.reportsService.findDoubleBookedUsers();
  }

  @Get('violated-constraints')
  getEventsWithViolatedConstraints() {
    return this.reportsService.findEventsWithViolatedConstraints();
  }

  @Get('resource-utilization')
  getResourceUtilization(@Query('organizationId') organizationId?: string) {
    return this.reportsService.getResourceUtilizationPerOrganization(organizationId);
  }

  @Get('parent-child-violations')
  getParentChildViolations() {
    return this.reportsService.findParentEventsWithInvalidChildren();
  }

  @Get('external-attendees')
  getEventsWithExternalAttendees(@Query('threshold') threshold?: string) {
    const thresholdNum = threshold ? parseInt(threshold, 10) : 10;
    return this.reportsService.findEventsWithExternalAttendeesExceedingThreshold(thresholdNum);
  }

  @Post('refresh-utilization-view')
  refreshUtilizationView() {
    return this.reportsService.refreshResourceUtilizationView();
  }

  @Get('capacity-utilization')
  getCapacityUtilization(@Query('organizationId') organizationId?: string) {
    return this.reportsService.getCapacityUtilization(organizationId);
  }

  @Get('show-up-rate')
  getShowUpRate(@Query('organizationId') organizationId?: string) {
    return this.reportsService.getShowUpRate(organizationId);
  }
}
