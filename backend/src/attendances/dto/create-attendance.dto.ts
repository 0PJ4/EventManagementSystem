import { IsUUID, IsEmail, IsString, IsNotEmpty, ValidateIf, IsOptional } from 'class-validator';

export class CreateAttendanceDto {
  @IsUUID()
  @IsNotEmpty()
  eventId: string;

  @IsUUID()
  @ValidateIf(o => !o.userEmail)
  @IsNotEmpty()
  userId?: string | null;

  @IsEmail()
  @ValidateIf(o => !o.userId)
  @IsNotEmpty()
  userEmail?: string | null;

  @IsString()
  @ValidateIf(o => !o.userId)
  @IsOptional()
  userName?: string | null;
}
