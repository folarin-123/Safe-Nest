import { IsOptional, IsString, IsNumber, IsPositive, IsObject } from 'class-validator';

export class UpsertFinancialProfileDto {
  /** PRD: monthlyIncome */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  monthlyIncome?: number;

  /** PRD: incomeFrequency */
  @IsOptional()
  @IsString()
  incomeFrequency?: string;

  /** PRD: fixedExpenses */
  @IsOptional()
  @IsObject()
  fixedExpenses?: Record<string, unknown>;

  /** PRD: variableExpenses */
  @IsOptional()
  @IsObject()
  variableExpenses?: Record<string, unknown>;

  /** PRD: existingSavings */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  existingSavings?: number;

  @IsOptional()
  @IsObject()
  existingCommitments?: Record<string, unknown>;
}

// Backward-compat alias
export { UpsertFinancialProfileDto as UpdateFinancialProfileDto };
