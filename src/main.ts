import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ApiResponseInterceptor } from './common/interceptors/transform.interceptor';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('Bootstrap');
  const configService = app.get(ConfigService);
  const frontendUrl = configService.get<string>('FRONTEND_URL');
  const isProduction = process.env.NODE_ENV === 'production';

  // ── Global API prefix — all routes are prefixed /api/v1 ──────────────────
  app.setGlobalPrefix('api/v1', {
    exclude: [
      'auth/google',
      'auth/google/callback',
      'auth/facebook',
      'auth/facebook/callback',
      'login',
    ],
  });

  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('ejs');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  
  app.useGlobalFilters(new HttpExceptionFilter());

  // ── Structured API response format ────────────────────────────────────────
  app.useGlobalInterceptors(new ApiResponseInterceptor());

  // ── Security headers ──────────────────────────────────────────────────────
  app.use(helmet());

  // ── CORS ──────────────────────────────────────────────────────────────────
  const corsOrigin = frontendUrl
    ? frontendUrl.split(',').map((v) => v.trim())
    : isProduction
      ? false
      : true;

  app.enableCors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  if (isProduction && !frontendUrl) {
    logger.warn(
      'FRONTEND_URL is not configured. CORS is disabled until a valid origin is set.',
    );
  }

  const port = process.env.PORT || 5052;

  await app.listen(port);

  logger.log(`SafeNest running on port ${port} — base: /api/v1`);
}

bootstrap();