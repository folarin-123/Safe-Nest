import { IsNotEmpty, IsString } from 'class-validator';

export class Disable2faDto {
  @IsNotEmpty()
  @IsString()
  password!: string;
}
