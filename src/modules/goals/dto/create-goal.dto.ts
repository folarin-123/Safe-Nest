import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsDateString,
  IsIn,
  IsOptional,
  IsInt,
} from 'class-validator';

const CONTRIBUTION_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;

export class CreateGoalDto {
  @IsString()
  @IsNotEmpty()
  goalName!: string;

  @IsNumber()
  @IsPositive({ message: 'Target amount must be greater than 0' })
  targetAmount!: number;

  @IsDateString({}, { message: 'Deadline must be a valid date (YYYY-MM-DD)' })
  deadline!: string;

  @IsIn(CONTRIBUTION_FREQUENCIES, {
    message: 'contributionFrequency must be one of: daily, weekly, monthly',
  })
  contributionFrequency!: 'daily' | 'weekly' | 'monthly';

  @IsOptional()
  @IsNumber()
  @IsPositive()
  preferredContribution?: number;

  @IsOptional()
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @IsString()
  description?: string;
}