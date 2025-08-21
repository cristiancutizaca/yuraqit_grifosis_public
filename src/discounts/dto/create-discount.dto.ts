import { Type } from 'class-transformer';
import { IsString, IsNumber, Min, Max, IsBoolean, IsOptional } from 'class-validator';

export class CreateDiscountDto {
  @IsString()
  name: string;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(100)
  percentage: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsNumber()
  createdBy: number;
}
