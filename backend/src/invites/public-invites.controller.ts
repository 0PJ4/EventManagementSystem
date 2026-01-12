import { Controller, Get, Post, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('invites/public')
@Public()
export class PublicInvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Get(':token')
  getPublicInvite(@Param('token') token: string) {
    return this.invitesService.getPublicInvite(token);
  }

  @Post(':token/accept')
  @HttpCode(HttpStatus.OK)
  acceptPublic(@Param('token') token: string) {
    return this.invitesService.acceptPublic(token);
  }

  @Post(':token/decline')
  @HttpCode(HttpStatus.OK)
  declinePublic(@Param('token') token: string) {
    return this.invitesService.declinePublic(token);
  }
}
