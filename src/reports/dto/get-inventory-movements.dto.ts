// src/reports/dto/get-inventory-movements.dto.ts
import { IsOptional, IsString, IsNumberString } from 'class-validator';

export class GetInventoryMovementsDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  movementType?: string;

  @IsOptional()
  @IsNumberString()
  productId?: number;

  @IsOptional()
  @IsNumberString()
  tankId?: number;
}
