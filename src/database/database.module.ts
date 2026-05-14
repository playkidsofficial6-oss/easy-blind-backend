import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        // TEST_MONGO_URI is intentionally kept separate so automated tests can
        // use mongodb-memory-server even when a developer has a local .env file.
        uri:
          process.env.TEST_MONGO_URI ??
          configService.getOrThrow<string>('MONGO_URI'),
        autoIndex: configService.get<string>('NODE_ENV') !== 'production',
        serverSelectionTimeoutMS: 5000,
      }),
    }),
  ],
})
export class DatabaseModule {}
