import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { GoalsModule } from './modules/goals/goals.module';
import { ContributionsModule } from './modules/contributions/contributions.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { FinancialProfileModule } from './modules/financial-profile/financial-profile.module';
import { PrismaModule } from './prisma/prisma.module';
import { EmailModule } from './common/email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, unknown>) => {
        const jwtSecret = config.JWT_SECRET;

        if (typeof jwtSecret !== 'string' || jwtSecret.trim().length < 32) {
          throw new Error(
            'JWT_SECRET must be set and contain at least 32 characters.',
          );
        }

        if (typeof config.DATABASE_URL !== 'string' || !config.DATABASE_URL) {
          throw new Error('DATABASE_URL must be set.');
        }

        if (typeof config.SMTP_HOST !== 'string' || !config.SMTP_HOST.trim()) {
          throw new Error('SMTP_HOST must be set.');
        }

        if (typeof config.SMTP_PORT !== 'string' || !config.SMTP_PORT.trim()) {
          throw new Error('SMTP_PORT must be set.');
        }

        if (typeof config.SMTP_USER !== 'string' || !config.SMTP_USER.trim()) {
          throw new Error('SMTP_USER must be set.');
        }

        if (typeof config.SMTP_PASS !== 'string' || !config.SMTP_PASS.trim()) {
          throw new Error('SMTP_PASS must be set.');
        }

        return config;
      },
    }),
    EmailModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    GoalsModule,
    ContributionsModule,
    NotificationsModule,
    AnalyticsModule,
    FinancialProfileModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
