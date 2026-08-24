import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { GoalsModule } from './modules/goals/goals.module';
import { ContributionsModule } from './modules/contributions/contributions.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { FinancialProfileModule } from './modules/financial-profile/financial-profile.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { EmailModule } from './common/email/email.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, unknown>) => {
        // ──────────────────────────────────────────────
        // 1. JWT (required)
        // ──────────────────────────────────────────────
        const jwtSecret = config.JWT_SECRET;
        if (typeof jwtSecret !== 'string' || jwtSecret.trim().length < 32) {
          throw new Error(
            'JWT_SECRET must be set and contain at least 32 characters.',
          );
        }

        if (
          typeof config.JWT_EXPIRES_IN !== 'string' ||
          !/^[0-9]+[smhd]$/.test(config.JWT_EXPIRES_IN)
        ) {
          throw new Error(
            'JWT_EXPIRES_IN must be set and use a valid duration like 15m, 1h, or 24h.',
          );
        }

        // ──────────────────────────────────────────────
        // 2. Database (required)
        // ──────────────────────────────────────────────
        if (typeof config.DATABASE_URL !== 'string' || !config.DATABASE_URL) {
          throw new Error('DATABASE_URL must be set.');
        }

        // ──────────────────────────────────────────────
        // 3. Email (SendGrid Web API – required)
        // ──────────────────────────────────────────────
        if (
          typeof config.SENDGRID_API_KEY !== 'string' ||
          !config.SENDGRID_API_KEY.trim()
        ) {
          throw new Error('SENDGRID_API_KEY must be set.');
        }

        if (
          typeof config.EMAIL_FROM !== 'string' ||
          !config.EMAIL_FROM.trim()
        ) {
          throw new Error('EMAIL_FROM must be set.');
        }

        // ──────────────────────────────────────────────
        // 4. Frontend URL (for CORS, optional in dev but required in prod)
        // ──────────────────────────────────────────────
        if (typeof config.FRONTEND_URL === 'string' && config.FRONTEND_URL.trim()) {
          config.FRONTEND_URL.split(',').forEach((entry) => {
            const value = entry.trim();
            if (value) {
              try {
                new URL(value);
              } catch {
                throw new Error(
                  'FRONTEND_URL must be a valid URL or comma-separated list of URLs.',
                );
              }
            }
          });
        }

        if (
          config.NODE_ENV === 'production' &&
          (!config.FRONTEND_URL || typeof config.FRONTEND_URL !== 'string' || !config.FRONTEND_URL.trim())
        ) {
          throw new Error('FRONTEND_URL must be set in production.');
        }

        // ──────────────────────────────────────────────
        // 5. App base URL (for password reset links)
        // ──────────────────────────────────────────────
        if (config.NODE_ENV === 'production') {
          if (typeof config.APP_BASE_URL !== 'string' || !config.APP_BASE_URL.trim()) {
            throw new Error('APP_BASE_URL must be set in production (e.g. https://myapp.com).');
          }
          try {
            new URL(config.APP_BASE_URL as string);
          } catch {
            throw new Error('APP_BASE_URL must be a valid URL in production.');
          }
        } else {
          // In development, fallback to localhost if not set
          if (!config.APP_BASE_URL || typeof config.APP_BASE_URL !== 'string' || !config.APP_BASE_URL.trim()) {
            config.APP_BASE_URL = 'http://localhost:3000';
          }
        }

        // ──────────────────────────────────────────────
        // 6. OAuth (Google / Facebook) – COMPLETELY OPTIONAL
        // ──────────────────────────────────────────────
        // (Nothing to validate – they're not required)

        return config;
      },
    }),
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 20,
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
    PaymentsModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}