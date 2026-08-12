import { IsNumber, IsPositive, IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

const TRACKING_TYPES = ['MANUAL', 'BANK_SYNC'] as const;

export class CreateContributionDto {
  @IsNumber()
  @IsPositive({ message: 'Amount must be greater than 0' })
  amount!: number;

  @IsDateString({}, { message: 'contributionDate must be a valid date (YYYY-MM-DD)' })
  contributionDate!: string;

  /** PRD: trackingType — MANUAL or BANK_SYNC */
  @IsIn(TRACKING_TYPES, {
    message: 'trackingType must be one of: MANUAL, BANK_SYNC',
  })
  trackingType!: 'MANUAL' | 'BANK_SYNC';

  @IsOptional()
  @IsString()
  externalReference?: string;
}