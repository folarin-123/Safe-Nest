import { IsNumber, IsPositive, IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

const SOURCE_TYPES = ['manual', 'bank_transfer', 'card', 'automatic'] as const;

export class CreateContributionDto {
  @IsNumber()
  @IsPositive({ message: 'Amount must be greater than 0' })
  amount!: number;

  @IsDateString({}, { message: 'contributionDate must be a valid date (YYYY-MM-DD)' })
  contributionDate!: string;

  @IsIn(SOURCE_TYPES, {
    message: 'sourceType must be one of: manual, bank_transfer, card, automatic',
  })
  sourceType!: 'manual' | 'bank_transfer' | 'card' | 'automatic';

  @IsOptional()
  @IsString()
  externalReference?: string;
}