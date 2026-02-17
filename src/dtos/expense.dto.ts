import { IsNumber, IsNotEmpty, IsDecimal, IsOptional, IsString } from 'class-validator';

export class CreateExpenseDto {
  @IsNumber()
  @IsNotEmpty()
  companyId!: number;

  @IsNumber()
  @IsNotEmpty()
  expenseType!: number;

  @IsDecimal()
  @IsNotEmpty()
  amount!: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  businessYear!: number;

  @IsNumber()
  @IsOptional()
  status?: number;
}

export class UpdateExpenseDto {
  @IsNumber()
  @IsOptional()
  companyId?: number;

  @IsNumber()
  @IsOptional()
  expenseType?: number;

  @IsDecimal()
  @IsOptional()
  amount?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  businessYear?: number;

  @IsNumber()
  @IsOptional()
  status?: number;
}