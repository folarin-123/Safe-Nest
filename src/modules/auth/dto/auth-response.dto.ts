import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';

// 1. Strongly typed User object (Excludes sensitive data like password)
export class UserResponseDto {
  @ApiProperty({ example: 'clx123abc456def789' })
  @IsString()
  id!: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  @IsString()
  email!: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  firstName!: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName!: string;

  @ApiProperty({ example: '2026-08-09T20:25:56.132Z' })
  createdAt!: Date;
}

// 2. Main Auth Response DTO
export class AuthResponseDto {
  @ApiProperty({
    description: 'JWT Bearer Access Token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  accessToken!: string;

  @ApiProperty({ type: UserResponseDto })
  @ValidateNested()
  @Type(() => UserResponseDto)
  user!: UserResponseDto;
}
