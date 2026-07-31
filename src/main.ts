import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  const uploadDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }
  app.useStaticAssets(uploadDir, { prefix: '/uploads/' });

  app.setGlobalPrefix(configService.get<string>('API_PREFIX', 'api'));
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.use(helmet());
  app.use(compression());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Easy Blind Backend API')
    .setDescription(
      'NestJS API for Easy-Blinds job, authentication, user management, fitters, measurements, live location, and Flutter app integrations.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT Bearer token',
        in: 'header',
      },
      'bearer',
    )
    .addTag('auth', 'Authentication and profile operations')
    .addTag('users', 'User management, password resets, check-in/out')
    .addTag('jobs', 'Core job management and workflow transitions')
    .addTag('measurements', 'Job measurement records and summaries')
    .addTag('live-location', 'Real-time salesman/fitter location tracking')
    .addTag('flutter-salesman', 'Flutter salesman app endpoints')
    .addTag('flutter-fitter', 'Flutter fitter app endpoints')
    .addTag('flutter-uploads', 'Flutter image upload endpoints')
    .addTag('flutter-live-location', 'Flutter live location endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/swagger', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = configService.get<number>('PORT', 3001);
  await app.listen(port);
}

void bootstrap();
