import { Module } from '@nestjs/common';
import { LiveLocationService } from './live-location.service';
import { LiveLocationController } from './live-location.controller';

@Module({
  controllers: [LiveLocationController],
  providers: [LiveLocationService],
})
export class LiveLocationModule {}
