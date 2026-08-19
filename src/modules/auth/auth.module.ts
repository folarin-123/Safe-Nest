import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { EmailModule } from '../../common/email/email.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { GoogleStrategy } from './strategies/google.strategy';
import { FacebookStrategy } from './strategies/facebook.strategy';
import { GoogleAuthGuard } from '../../common/guards/google-auth.guard';
import { FacebookAuthGuard } from '../../common/guards/facebook-auth.guard';
import { OAuthController } from './oauth.controller';
import { ViewController } from './view.controller';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    ConfigModule,
    EmailModule,
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') ?? '1h',
        },
      }),
    }),
    UsersModule,
    AnalyticsModule,
  ],
  controllers: [AuthController, OAuthController, ViewController],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    FacebookStrategy,
    GoogleAuthGuard,
    FacebookAuthGuard,
  ],
  exports: [AuthService],
})
export class AuthModule {}
