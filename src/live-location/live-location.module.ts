import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LiveLocationController } from './live-location.controller';
import { LiveLocationService } from './live-location.service';
import {
  LiveLocation,
  LiveLocationSchema,
} from './schemas/live-location.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LiveLocation.name, schema: LiveLocationSchema },
    ]),
  ],
  controllers: [LiveLocationController],
  providers: [LiveLocationService],
  exports: [LiveLocationService],
})
export class LiveLocationModule {}
