import { ApiProperty } from '@nestjs/swagger';
import { JobStatus } from '../../../jobs/schemas/job.schema';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class JobStatusDto {
  @ApiProperty({
    enum: [JobStatus.FitterOnTheWay, JobStatus.FitterReached, JobStatus.Fitting, JobStatus.TakingPhotos, JobStatus.Completed, JobStatus.FitterCancelled],
    description: 'New status for the job',
    example: JobStatus.FitterOnTheWay,
  })
  @IsEnum([JobStatus.FitterOnTheWay, JobStatus.FitterReached, JobStatus.Fitting, JobStatus.TakingPhotos, JobStatus.Completed, JobStatus.FitterCancelled])
  status: JobStatus;

  @ApiProperty({
    description: 'Note added by customer',
    type: 'string',
    required: false,
    example: 'Customer wants extra discount',
  })
  @IsString()
  @IsOptional()
  customerNote?: string;
}
