import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import type { SignOptions } from 'jsonwebtoken';
import { LiveLocationService } from './live-location.service';
import { LiveLocationController } from './live-location.controller';
import { LiveLocationGateway } from './live-location.gateway';
import { User, UserSchema } from '../../users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>(
            'JWT_EXPIRES_IN',
            '1d',
          ) as SignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [LiveLocationController],
  providers: [LiveLocationService, LiveLocationGateway],
  exports: [LiveLocationService, LiveLocationGateway],
})
export class LiveLocationModule { }
