import { IsString, IsNumber, IsOptional, IsInt, Min, Max, IsBoolean } from 'class-validator';

export class SettingsQueryDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  group?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  type?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  isEnabled?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  isSystem?: number;

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

export class CreateSettingsDto {
  @IsString()
  key!: string;

  @IsString()
  name!: string;

  @IsString()
  value!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  type!: number;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  group?: string | null;

  @IsInt()
  @Min(0)
  @Max(1)
  isSystem!: number;

  @IsInt()
  @Min(0)
  @Max(1)
  isEnabled!: number;

  @IsOptional()
  @IsInt()
  sort?: number;

  @IsNumber()
  createdBy!: number;

  @IsNumber()
  updatedBy!: number;
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  type?: number;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  group?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2)
  isEnabled?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  isSystem?: number;

  @IsOptional()
  @IsInt()
  sort?: number;

  @IsNumber()
  updatedBy!: number;
}