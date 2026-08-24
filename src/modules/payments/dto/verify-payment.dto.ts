import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class VerifyPaymentDto {
  @IsString()
  @IsNotEmpty()
  transactionReference!: string;

  @IsUUID()
  @IsNotEmpty()
  goalId!: string;
}
