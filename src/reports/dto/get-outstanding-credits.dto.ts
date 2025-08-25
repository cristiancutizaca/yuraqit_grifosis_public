// src/reports/dto/get-outstanding-credits.dto.ts
import { IsOptional, IsString, IsNumberString } from 'class-validator';

export class GetOutstandingCreditsDto {
  @IsOptional()
  @IsNumberString()
  clientId?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  dueDateStart?: string;

  @IsOptional()
  @IsString()
  dueDateEnd?: string;
}
