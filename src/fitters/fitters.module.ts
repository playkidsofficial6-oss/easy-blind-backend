import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { FittersController } from './fitters.controller';
import { FittersService } from './fitters.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [FittersController],
  providers: [FittersService],
  exports: [FittersService],
})
export class FittersModule {}
