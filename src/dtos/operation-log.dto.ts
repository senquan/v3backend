import { IsString, IsNumber, IsOptional, IsInt, Min, Max, IsArray } from 'class-validator';

export class OperationLogQueryDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  operationModule?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  operationType?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2)
  status?: number;

  @IsOptional()
  @IsArray()
  dateRange?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  size?: number = 10;
}

export class CreateOperationLogDto {
  @IsNumber()
  userId!: number;

  @IsString()
  operationModule!: string;

  @IsInt()
  @Min(1)
  @Max(7)
  operationType!: number;

  @IsString()
  operationDesc!: string;

  @IsString()
  requestUrl!: string;

  @IsString()
  requestMethod!: string;

  @IsOptional()
  @IsString()
  requestParams?: string;

  @IsOptional()
  @IsString()
  responseResult?: string;

  @IsString()
  clientIp!: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  executionTime?: number;

  @IsInt()
  @Min(1)
  @Max(2)
  status!: number;

  @IsNumber()
  createdBy!: number;

  @IsNumber()
  updatedBy!: number;
}

export class UpdateOperationLogDto {
  @IsOptional()
  @IsString()
  operationDesc?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2)
  status?: number;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsNumber()
  updatedBy!: number;
}