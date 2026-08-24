import { IsNotEmpty, IsString } from 'class-validator';

export class Verify2FaLoginDto {
  @IsString()
  @IsNotEmpty()
  challengeToken!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;
}
