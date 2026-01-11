import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  @Public()
  @Get()
  getApiInfo() {
    return {
      message: 'Event Booking System API',
      version: '1.0.0',
      endpoints: {
        auth: {
          login: '/auth/login',
          register: '/auth/register',
          profile: '/auth/profile',
        },
        organizations: '/organizations',
        users: '/users',
        events: '/events',
        resources: '/resources',
        attendances: '/attendances',
        allocations: '/allocations',
        invites: '/invites',
        reports: '/reports',
      },
    };
  }
}
