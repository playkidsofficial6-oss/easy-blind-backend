import { Module } from '@nestjs/common';
import { SalesManModule } from './sales-man/sales-man.module';
import { FitterModule } from './fitter/fitter.module';

@Module({
  imports: [SalesManModule, FitterModule]
})
export class FlutterModule {}
