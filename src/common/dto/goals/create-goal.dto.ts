import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsDateString,
  IsEnum,
  IsOptional,
  Min,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ContributionFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

export class CreateGoalDto {
  

  @IsString()
  @IsNotEmpty()
  goalName!: string;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  targetAmount!: number;

  @IsDateString()
  @IsNotEmpty()
  deadline!: string;

  @IsEnum(ContributionFrequency)
  @IsNotEmpty()
  contributionFrequency!: ContributionFrequency;

 

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  currentAmount?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  preferredContribution?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  categoryId?: number;
}