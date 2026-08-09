import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cors from 'cors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global pipes, guards, interceptors
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.use(helmet());
  app.use(cors());

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`SafeNest running on port ${port}`);
}
bootstrap();
