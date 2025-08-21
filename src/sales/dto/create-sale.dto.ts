import {
  IsNumber,
  IsString,
  IsOptional,
  IsPositive,
  IsBoolean,
  IsDateString,
} from 'class-validator';

export class CreateSaleDto {
  @IsOptional()
  @IsNumber()
  client_id?: number;

  @IsNumber()
  user_id: number;

  @IsOptional()
  @IsNumber()
  employee_id?: number;

  @IsNumber()
  nozzle_id: number;

  @IsNumber()
  @IsPositive()
  total_amount: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  discount_amount?: number;

  @IsNumber()
  @IsPositive()
  final_amount: number;

  @IsNumber()
  payment_method_id: number;

  // 👉 NUEVO: permite enviar también el nombre del método (“credito”, “efectivo”, etc.)
  @IsOptional()
  @IsString()
  payment_method?: string;

  @IsOptional()
  @IsString()
  shift?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsBoolean()
  applyDynamicPricing?: boolean;

  // Fecha de vencimiento para ventas a crédito (YYYY-MM-DD)
  @IsOptional()
  @IsDateString()
  due_date?: string;
}
