import { IsNotEmpty, IsString } from 'class-validator';

export class Enable2FaDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}
