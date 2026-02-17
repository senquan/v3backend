import { IsNumber, IsNotEmpty, IsDecimal, IsDateString, IsOptional } from 'class-validator';

export class CreateDepositDto {
  @IsNumber()
  @IsNotEmpty()
  companyId!: number;

  @IsNumber()
  @IsNotEmpty()
  depositType!: number;

  @IsDecimal()
  @IsNotEmpty()
  balance!: number;

  @IsDecimal()
  @IsOptional()
  interestRate?: number;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsNumber()
  yearNum!: number;
}

export class UpdateDepositDto {
  @IsNumber()
  @IsOptional()
  companyId?: number;

  @IsNumber()
  @IsOptional()
  depositType?: number;

  @IsDecimal()
  @IsOptional()
  balance?: number;

  @IsDecimal()
  @IsOptional()
  interestRate?: number;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsNumber()
  @IsOptional()
  yearNum?: number;
}