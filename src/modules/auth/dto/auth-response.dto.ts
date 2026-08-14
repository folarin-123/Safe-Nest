import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';

export class UserResponseDto {
  @IsString()
  id!: string;

  @IsString()
  email!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  createdAt!: Date;
}

export class AuthResponseDto {
  @IsString()
  @IsNotEmpty()
  accessToken!: string;

  @ValidateNested()
  @Type(() => UserResponseDto)
  user!: UserResponseDto;
}