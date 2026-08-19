import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class ResetPasswordDto {
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,128}$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
  })
  @Length(8, 128, { message: 'Password must be between 8 and 128 characters.' })
  @IsNotEmpty({ message: 'New password is required.' })
  @IsString()
  newPassword!: string;

  @IsString()
  @IsNotEmpty({ message: 'Password confirmation is required.' })
  @Length(8, 128)
  confirmPassword!: string;
}
