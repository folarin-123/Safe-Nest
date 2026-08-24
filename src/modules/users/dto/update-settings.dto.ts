import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  contributionReminder?: boolean;

  @IsOptional()
  @IsBoolean()
  missedContributionAlert?: boolean;

  @IsOptional()
  @IsBoolean()
  milestoneCelebration?: boolean;

  @IsOptional()
  @IsBoolean()
  smartInsights?: boolean;

  @IsOptional()
  @IsBoolean()
  emailUpdate?: boolean;

  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;
}