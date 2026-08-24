import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyLogin2faDto {
  @IsNotEmpty()
  @IsString()
  challengeToken!: string;

  @IsNotEmpty()
  @IsString()
  code!: string;
}
