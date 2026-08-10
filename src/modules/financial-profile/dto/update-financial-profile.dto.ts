import { IsOptional, IsString, IsNumber, IsPositive, IsArray, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateFinancialProfileDto {
  @IsOptional()
  @IsNumber()
  @IsPositive()
  incomeAmount?: number;

  @IsOptional()
  @IsString()
  incomeFrequency?: string;

  @IsOptional()
  @IsObject()
  fixedExpenses?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  variableExpenses?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  existingSavings?: number;

  @IsOptional()
  @IsObject()
  existingCommitments?: Record<string, unknown>;
}
