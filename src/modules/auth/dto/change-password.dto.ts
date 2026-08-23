import { IsNotEmpty, IsString } from 'class-validator';
import { ResetPasswordDto } from './reset-password.dto';

export class ChangePasswordDto extends ResetPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Current password is required.' })
  oldPassword!: string;
}