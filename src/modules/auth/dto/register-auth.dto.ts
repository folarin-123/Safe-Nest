import { 
  IsEmail, 
  IsNotEmpty, 
  IsOptional, 
  IsPhoneNumber, 
  IsString, 
  Length, 
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterAuthDto {
  // 1. EMAIL
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({ require_tld: true }, { message: 'Please provide a valid email address.' })
  @IsNotEmpty({ message: 'Email is required.' })
  @IsString()
  email!: string;

  // 2. PHONE NUMBER
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsPhoneNumber(undefined, { message: 'Please provide a valid phone number (e.g. +234...).' })
  @IsNotEmpty({ message: 'Phone number is required.' })
  @IsString()
  phone!: string;

  // 3. PASSWORD (NO TRANSFORM)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,128}$/, {
    message: 
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
  })
  @Length(8, 128, { message: 'Password must be between 8 and 128 characters.' })
  @IsNotEmpty({ message: 'Password is required.' })
  @IsString()
  password!: string;

  // 4. FIRST NAME (Convert empty strings to undefined)
  @Transform(({ value }) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined))
  @IsOptional()
  @Length(1, 100, { message: 'First name must be between 1 and 100 characters.' })
  @IsString()
  firstName?: string;

 
  @Transform(({ value }) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined))
  @IsOptional()
  @Length(1, 100, { message: 'Last name must be between 1 and 100 characters.' })
  @IsString()
  lastName?: string;

  
  get fullName(): string {
    const names = [this.firstName, this.lastName].filter(Boolean);
    return names.length > 0 ? names.join(' ') : 'User';
  }
}