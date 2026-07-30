import { Module } from '@nestjs/common';
import { FitterService } from './fitter.service';
import { FitterController } from './fitter.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Job, JobSchema } from '../../jobs/schemas/job.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Job.name, schema: JobSchema },
    ]),
  ],
  controllers: [FitterController],
  providers: [FitterService],
})
export class FitterModule {}
