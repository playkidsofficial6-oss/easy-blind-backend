import { JobStatus } from "src/jobs/schemas/job.schema";
import { IsEnum, IsOptional } from "class-validator";

export class JobStatusDto {

    @IsEnum(JobStatus)
    status: JobStatus;

  
}
