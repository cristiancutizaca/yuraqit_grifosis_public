// src/reports/dto/get-cash-flow.dto.ts
import { IsOptional, IsString } from 'class-validator';

export class GetCashFlowDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;
}
