import { IsOptional, IsPhoneNumber, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateUserDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString()
  @Length(1, 100)
  firstName?: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString()
  @Length(1, 100)
  lastName?: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsPhoneNumber(undefined)
  phone?: string;
}
