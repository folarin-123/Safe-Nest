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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
