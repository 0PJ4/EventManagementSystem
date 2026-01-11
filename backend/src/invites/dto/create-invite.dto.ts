import { IsUUID, IsEmail, IsString, IsOptional, ValidateIf, IsNotEmpty } from 'class-validator';

export class CreateInviteDto {
  @IsUUID()
  @IsNotEmpty()
  eventId: string;

  @IsUUID()
  @ValidateIf(o => !o.userEmail)
  @IsOptional()
  userId?: string | null;

  @IsEmail()
  @ValidateIf(o => !o.userId)
  @IsOptional()
  userEmail?: string | null;

  @IsString()
  @ValidateIf(o => !o.userId)
  @IsOptional()
  userName?: string | null;

  @IsUUID()
  @IsNotEmpty()
  invitedByOrganizationId: string;

  @IsUUID()
  @IsOptional()
  invitedByUserId?: string | null;
}
