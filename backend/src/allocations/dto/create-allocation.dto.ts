import { IsUUID, IsInt, IsNotEmpty, Min } from 'class-validator';

export class CreateAllocationDto {
  @IsUUID()
  @IsNotEmpty()
  eventId: string;

  @IsUUID()
  @IsNotEmpty()
  resourceId: string;

  @IsInt()
  @Min(1)
  @IsNotEmpty()
  quantity: number;
}
