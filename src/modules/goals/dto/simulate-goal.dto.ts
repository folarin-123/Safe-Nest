import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsNumber, IsOptional, IsPositive, Min } from 'class-validator';

const CONTRIBUTION_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;


export class SimulateGoalDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive({ message: 'targetAmount must be greater than 0' })
  targetAmount!: number;

  @IsDateString({}, { message: 'deadline must be a valid ISO date' })
  deadline!: string;

  @IsIn(CONTRIBUTION_FREQUENCIES, {
    message: 'frequency must be one of: DAILY, WEEKLY, MONTHLY',
  })
  frequency!: (typeof CONTRIBUTION_FREQUENCIES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'currentAmount cannot be negative' })
  currentAmount?: number;
}
