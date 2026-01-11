import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import { InvitesService } from './invites.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { UpdateInviteDto } from './dto/update-invite.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';

@Controller('invites')
@UseGuards(JwtAuthGuard)
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ORG)
  create(@Body() createInviteDto: CreateInviteDto) {
    return this.invitesService.create(createInviteDto);
  }

  // Get invites - users can see their own, admins/org can see all
  @Get()
  findAll(
    @Request() req,
    @Query('eventId') eventId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('userId') userId?: string,
  ) {
    const userRole = req.user.role;
    const currentUserId = req.user.id;
    
    // Regular users can only see their own invites
    if (userRole === UserRole.USER) {
      return this.invitesService.findAll(eventId, organizationId, currentUserId);
    }
    
    // Admin and org admins can filter by userId or see all
    return this.invitesService.findAll(eventId, organizationId, userId);
  }

  // Get my invites - endpoint for users to see their pending invites
  @Get('my-invites')
  getMyInvites(@Request() req) {
    return this.invitesService.findAll(undefined, undefined, req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invitesService.findOne(id);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  accept(@Param('id') id: string, @Request() req) {
    return this.invitesService.accept(id, req.user.id);
  }

  @Post(':id/decline')
  @HttpCode(HttpStatus.OK)
  decline(@Param('id') id: string, @Request() req) {
    return this.invitesService.decline(id, req.user.id);
  }

  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ORG)
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string, @Query('organizationId') organizationId: string) {
    return this.invitesService.cancel(id, organizationId);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ORG)
  remove(@Param('id') id: string) {
    return this.invitesService.remove(id);
  }
}
