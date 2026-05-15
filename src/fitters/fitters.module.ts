import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Fitter, FitterSchema } from './schemas/fitter.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { FittersController } from './fitters.controller';
import { FittersService } from './fitters.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Fitter.name, schema: FitterSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [FittersController],
  providers: [FittersService],
  exports: [FittersService],
})
export class FittersModule {}
