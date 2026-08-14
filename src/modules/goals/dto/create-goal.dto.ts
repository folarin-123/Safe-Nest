import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsDateString,
  IsIn,
  IsOptional,
  IsInt,
  Min,
} from 'class-validator';

const CONTRIBUTION_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;

const GOAL_CATEGORIES = [
  'RENT', 'SCHOOL_FEES', 'EMERGENCY', 'VACATION', 'CAPITAL', 'HOME',
] as const;

export class CreateGoalDto {
  @IsString()
  @IsNotEmpty()
  goalName!: string;

  @IsOptional()
  @IsIn(GOAL_CATEGORIES, {
    message: 'category must be one of: RENT, SCHOOL_FEES, EMERGENCY, VACATION, CAPITAL, HOME',
  })
  category?: (typeof GOAL_CATEGORIES)[number];

  @IsNumber()
  @IsPositive({ message: 'Target amount must be greater than 0' })
  targetAmount!: number;

  @IsDateString({}, { message: 'Deadline must be a valid date (YYYY-MM-DD)' })
  deadline!: string;

  @IsIn(CONTRIBUTION_FREQUENCIES, {
    message: 'contributionFrequency must be one of: DAILY, WEEKLY, MONTHLY',
  })
  contributionFrequency!: 'DAILY' | 'WEEKLY' | 'MONTHLY';

  @IsOptional()
  @IsNumber()
  @IsPositive()
  preferredContribution?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;
}