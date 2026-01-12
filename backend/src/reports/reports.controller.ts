import { Controller, Get, Post, Query, UseGuards, Request } from '@nestjs/common';
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
  getDoubleBookedUsers(@Request() req) {
    const organizationId = req.user.role === UserRole.ORG ? req.user.organizationId : undefined;
    return this.reportsService.findDoubleBookedUsers(organizationId);
  }

  @Get('violated-constraints')
  getEventsWithViolatedConstraints(@Request() req) {
    const organizationId = req.user.role === UserRole.ORG ? req.user.organizationId : undefined;
    return this.reportsService.findEventsWithViolatedConstraints(organizationId);
  }

  @Get('resource-utilization')
  getResourceUtilization(@Request() req, @Query('organizationId') organizationId?: string) {
    // If org admin, use their org; if admin, allow query param override
    const finalOrgId = req.user.role === UserRole.ORG ? req.user.organizationId : organizationId;
    return this.reportsService.getResourceUtilizationPerOrganization(finalOrgId);
  }

  @Get('parent-child-violations')
  getParentChildViolations(@Request() req) {
    const organizationId = req.user.role === UserRole.ORG ? req.user.organizationId : undefined;
    return this.reportsService.findParentEventsWithInvalidChildren(organizationId);
  }

  @Get('external-attendees')
  getEventsWithExternalAttendees(@Request() req, @Query('threshold') threshold?: string) {
    const thresholdNum = threshold ? parseInt(threshold, 10) : 10;
    const organizationId = req.user.role === UserRole.ORG ? req.user.organizationId : undefined;
    return this.reportsService.findEventsWithExternalAttendeesExceedingThreshold(thresholdNum, organizationId);
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
