import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsUUID } from 'class-validator';

export class InitiatePaymentDto {
  @IsUUID()
  @IsNotEmpty()
  goalId!: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;
}
