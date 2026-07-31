import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { JobsModule } from './jobs/jobs.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { LiveLocationModule } from './live-location/live-location.module';
import { MeasurementsModule } from './measurements/measurements.module';
import { validateEnvironment } from './config/env.validation';
import { FlutterModule } from './flutter/flutter.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      validate: validateEnvironment,
    }),
    DatabaseModule,
    JobsModule,
    UsersModule,
    LiveLocationModule,
    MeasurementsModule,
    AuthModule,
    FlutterModule,
  ],
})
export class AppModule {}
