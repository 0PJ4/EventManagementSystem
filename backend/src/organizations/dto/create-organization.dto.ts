import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  @Matches(/^(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|.*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/, {
    message: 'Email template must be like "@abc.in" or "*@abc.in"',
  })
  emailTemplate?: string | null;
}
