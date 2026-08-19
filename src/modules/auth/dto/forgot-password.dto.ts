import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class ForgotPasswordDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({ require_tld: true }, { message: 'Please provide a valid email address.' })
  @IsNotEmpty({ message: 'Email is required.' })
  @IsString()
  email!: string;
}
