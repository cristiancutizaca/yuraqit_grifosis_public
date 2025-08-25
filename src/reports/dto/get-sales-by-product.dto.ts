// src/reports/dto/get-sales-by-product.dto.ts
import { IsOptional, IsString, IsNumberString } from 'class-validator';

export class GetSalesByProductDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsNumberString()
  limit?: number;

  @IsOptional()
  @IsNumberString()
  productId?: number;
}
