import { IsNotEmpty, IsString } from 'class-validator';

export class LinkBankAccountDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}
