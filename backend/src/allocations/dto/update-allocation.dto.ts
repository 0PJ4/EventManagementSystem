import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateAllocationDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;
}
