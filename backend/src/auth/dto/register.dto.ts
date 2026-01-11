import { IsString, IsEmail, IsNotEmpty, MinLength, IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @MinLength(6)
  @IsNotEmpty()
  password: string;

  // organizationId is required but can be null for independent users
  // We'll validate this in the service
  @IsOptional()
  @IsUUID()
  organizationId?: string | null;
}
