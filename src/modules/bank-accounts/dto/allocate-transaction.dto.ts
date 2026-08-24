import { IsNotEmpty, IsUUID } from 'class-validator';

export class AllocateTransactionDto {
  @IsUUID()
  @IsNotEmpty()
  goalId!: string;
}
