import { Module } from '@nestjs/common';
import { SalesManModule } from './sales-man/sales-man.module';
import { FitterModule } from './fitter/fitter.module';
import { LiveLocationModule } from './live-location/live-location.module';

@Module({
  imports: [SalesManModule, FitterModule, LiveLocationModule]
})
export class FlutterModule {}
