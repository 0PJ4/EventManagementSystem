import { IsString, IsNotEmpty, IsUUID, IsEnum, IsInt, IsBoolean, IsOptional, Min } from 'class-validator';
import { ResourceType } from '../../entities/resource.entity';

export class CreateResourceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ResourceType)
  @IsNotEmpty()
  type: ResourceType;

  @IsUUID()
  @IsOptional()
  organizationId?: string | null;

  @IsInt()
  @Min(0)
  @IsNotEmpty()
  availableQuantity: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxConcurrentUsage?: number | null;

  @IsBoolean()
  @IsOptional()
  isGlobal?: boolean;
}
