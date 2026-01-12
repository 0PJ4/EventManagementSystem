import { Controller, Get, Post, Body, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { AttendancesService } from './attendances.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

@Controller('attendances')
@UseGuards(JwtAuthGuard)
export class AttendancesController {
  constructor(private readonly attendancesService: AttendancesService) {}

  @Post()
  register(@Body() createAttendanceDto: CreateAttendanceDto) {
    return this.attendancesService.register(createAttendanceDto);
  }

  @Post(':id/checkin')
  checkIn(@Param('id') id: string) {
    return this.attendancesService.checkIn(id);
  }

  @Public()
  @Post('public/:id/checkin')
  checkInPublic(@Param('id') id: string) {
    return this.attendancesService.checkIn(id);
  }

  @Get()
  findAll(@Query('eventId') eventId?: string) {
    return this.attendancesService.findAll(eventId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.attendancesService.remove(id);
  }
}
