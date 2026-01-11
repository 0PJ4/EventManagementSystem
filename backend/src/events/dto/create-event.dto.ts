import { IsString, IsNotEmpty, IsUUID, IsDateString, IsInt, IsEnum, IsBoolean, IsOptional, Min } from 'class-validator';
import { EventStatus } from '../../entities/event.entity';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @IsDateString()
  @IsNotEmpty()
  endTime: string;

  @IsInt()
  @Min(0)
  @IsNotEmpty()
  capacity: number;

  @IsUUID()
  @IsNotEmpty()
  organizationId: string;

  @IsUUID()
  @IsOptional()
  parentEventId?: string;

  @IsEnum(EventStatus)
  @IsOptional()
  status?: EventStatus;

  @IsBoolean()
  @IsOptional()
  allowExternalAttendees?: boolean;
}
