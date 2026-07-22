import { Module } from '@nestjs/common';
import { SalesManModule } from './sales-man/sales-man.module';

@Module({
  imports: [SalesManModule]
})
export class FlutterModule {}
