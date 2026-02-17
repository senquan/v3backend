import { IsNumber, IsNotEmpty, IsDecimal, IsDateString, IsOptional } from 'class-validator';

export class CreatePaymentDto {
  @IsNumber()
  @IsNotEmpty()
  companyId!: number;

  @IsNumber()
  @IsNotEmpty()
  paymentPhase!: number;

  @IsDecimal()
  @IsNotEmpty()
  plannedAmount!: number;

  @IsDecimal()
  @IsNotEmpty()
  actualAmount!: number;

  @IsDateString()
  @IsOptional()
  paymentDate?: string;

  @IsNumber()
  businessYear!: number;

  @IsNumber()
  @IsOptional()
  status?: number;
}

export class UpdatePaymentDto {
  @IsNumber()
  @IsOptional()
  companyId?: number;

  @IsNumber()
  @IsOptional()
  paymentPhase?: number;

  @IsDecimal()
  @IsOptional()
  plannedAmount?: number;

  @IsDecimal()
  @IsOptional()
  actualAmount?: number;

  @IsDateString()
  @IsOptional()
  paymentDate?: string;

  @IsNumber()
  @IsOptional()
  businessYear?: number;

  @IsNumber()
  @IsOptional()
  status?: number;
}