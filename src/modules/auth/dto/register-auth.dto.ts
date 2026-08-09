import { 
  IsEmail, 
  IsNotEmpty, 
  IsPhoneNumber, 
  IsString, 
  Length, 
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterAuthDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Full name is required.' })
  @Length(2, 200, { message: 'Full name must be between 2 and 200 characters.' })
  @Matches(/\S+\s+\S+/, {
    message: 'Full name must include at least a first and last name.',
  })
  fullName!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({ require_tld: true }, { message: 'Please provide a valid email address.' })
  @IsNotEmpty({ message: 'Email is required.' })
  @IsString()
  email!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsPhoneNumber(undefined, { message: 'Please provide a valid phone number (e.g. +234...).' })
  @IsNotEmpty({ message: 'Phone number is required.' })
  @IsString()
  phone!: string;

  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,128}$/, {
    message: 
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
  })
  @Length(8, 128, { message: 'Password must be between 8 and 128 characters.' })
  @IsNotEmpty({ message: 'Password is required.' })
  @IsString()
  password!: string;

  @IsString()
  @IsNotEmpty({ message: 'Password confirmation is required.' })
  @Length(8, 128)
  confirmPassword!: string;

  get firstName(): string {
    return this.fullName.split(' ')[0];
  }

  get lastName(): string | undefined {
    const remainingNames = this.fullName.split(' ').slice(1).join(' ');
    return remainingNames || undefined;
  }
}
