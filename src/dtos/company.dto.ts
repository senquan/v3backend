import { IsString, IsNotEmpty, IsNumber, IsOptional, IsDateString, IsDecimal } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  companyCode!: string;

  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @IsNumber()
  @IsOptional()
  parentCompanyId?: number;

  @IsNumber()
  companyLevel!: number;

  @IsNumber()
  @IsOptional()
  status?: number;
}

export class UpdateCompanyDto {
  @IsString()
  @IsOptional()
  companyName?: string;

  @IsNumber()
  @IsOptional()
  parentCompanyId?: number;

  @IsNumber()
  @IsOptional()
  companyLevel?: number;

  @IsNumber()
  @IsOptional()
  status?: number;
}