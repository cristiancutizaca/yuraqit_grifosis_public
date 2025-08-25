// src/reports/dto/get-current-stock.dto.ts
import { IsOptional, IsNumberString, IsString } from 'class-validator';

export class GetCurrentStockDto {
  @IsOptional()
  @IsNumberString()
  productId?: number;

  @IsOptional()
  @IsNumberString()
  tankId?: number;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}
