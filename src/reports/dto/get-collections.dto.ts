// src/reports/dto/get-collections.dto.ts
import { IsOptional, IsString, IsNumberString } from 'class-validator';

export class GetCollectionsDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsNumberString()
  clientId?: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;
}
