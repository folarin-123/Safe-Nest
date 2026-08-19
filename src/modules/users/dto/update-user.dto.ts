import { IsOptional, IsPhoneNumber, IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateUserDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') || undefined : value,
  )
  @IsOptional()
  @IsString()
  @Length(2, 200)
  @Matches(/\S+\s+\S+/, {
    message: 'Full name must include at least a first and last name.',
  })
  fullName?: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsPhoneNumber(undefined)
  phone?: string;
}
