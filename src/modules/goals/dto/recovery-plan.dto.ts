import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class RecoveryPlanDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'missedAmount cannot be negative' })
  missedAmount!: number;
}
