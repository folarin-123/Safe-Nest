import { Transform, Type } from 'class-transformer';
import { IsDate, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Min, MinDate, Validate, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

const CONTRIBUTION_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;
const GOAL_CATEGORIES = ['RENT', 'SCHOOL_FEES', 'EMERGENCY', 'VACATION', 'CAPITAL', 'HOME'] as const;

@ValidatorConstraint({ name: 'futureCalendarDate', async: false })
class FutureCalendarDateConstraint implements ValidatorConstraintInterface {
  validate(value: Date): boolean {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const deadline = new Date(value); deadline.setHours(0, 0, 0, 0);
    return deadline > today;
  }
  defaultMessage(): string { return 'deadline must be a future calendar date'; }
}

export class CreateGoalDto {
  @IsString() @IsNotEmpty() goalName!: string;
  @IsOptional() @IsIn(GOAL_CATEGORIES) category?: (typeof GOAL_CATEGORIES)[number];
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive({ message: 'Target amount must be greater than 0' }) targetAmount!: number;
  @Transform(({ value }) => typeof value === 'string' ? new Date(`${value}T00:00:00.000Z`) : value)
  @Type(() => Date) @IsDate({ message: 'Deadline must be a valid date (YYYY-MM-DD)' }) @MinDate(new Date()) @Validate(FutureCalendarDateConstraint) deadline!: Date;
  @IsIn(CONTRIBUTION_FREQUENCIES) contributionFrequency!: (typeof CONTRIBUTION_FREQUENCIES)[number];
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() preferredContribution?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) priority?: number;
}
