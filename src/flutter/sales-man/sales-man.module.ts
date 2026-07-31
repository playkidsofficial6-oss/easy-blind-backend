import { Module } from '@nestjs/common';
import { SalesManService } from './sales-man.service';
import { SalesManController } from './sales-man.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Job, JobSchema } from '../../jobs/schemas/job.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Job.name, schema: JobSchema }])],
  controllers: [SalesManController],
  providers: [SalesManService],
})
export class SalesManModule {}
