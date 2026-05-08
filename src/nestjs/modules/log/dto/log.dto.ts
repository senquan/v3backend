import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { LogLevel, LogCategory } from '../../../../models/system-log.model';

export class QueryLogDto {
  @IsOptional()
  @IsEnum(LogLevel)
  level?: LogLevel;

  @IsOptional()
  @IsEnum(LogCategory)
  category?: LogCategory;

  @IsOptional()
  @Transform(({ value }) => value ? new Date(value) : undefined)
  startDate?: Date;

  @IsOptional()
  @Transform(({ value }) => value ? new Date(value) : undefined)
  endDate?: Date;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  traceId?: string;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10) || 1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10) || 50)
  pageSize?: number = 50;
}

export class VerifyIntegrityDto {
  @IsOptional()
  @IsInt()
  startSequence?: number;

  @IsOptional()
  @IsInt()
  endSequence?: number;
}

export class CleanLogsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  daysToKeep?: number = 30;
}
