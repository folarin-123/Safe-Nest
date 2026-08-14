import { IsNumber, IsPositive, IsDateString, IsIn, IsNotEmpty, IsString, ValidateIf } from 'class-validator';

const TRACKING_TYPES = ['MANUAL', 'BANK_SYNC'] as const;

export class CreateContributionDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'Amount must be greater than 0' })
  amount!: number;

  @IsDateString({}, { message: 'contributionDate must be a valid date (YYYY-MM-DD)' })
  contributionDate!: string;

 
  @IsIn(TRACKING_TYPES, {
    message: 'trackingType must be one of: MANUAL, BANK_SYNC',
  })
  trackingType!: 'MANUAL' | 'BANK_SYNC';

  @ValidateIf((dto: CreateContributionDto) => dto.trackingType === 'BANK_SYNC')
  @IsString()
  @IsNotEmpty({ message: 'externalReference is required for BANK_SYNC contributions' })
  externalReference?: string;
}
