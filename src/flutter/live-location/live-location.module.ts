import { Module } from '@nestjs/common';
import { LiveLocationService } from './live-location.service';
import { LiveLocationController } from './live-location.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/users/schemas/user.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),],
  controllers: [LiveLocationController],
  providers: [LiveLocationService],
})
export class LiveLocationModule { }
