import { JobStatus, SalesmanWorkflowStatus } from "src/jobs/schemas/job.schema";
import { IsEnum } from "class-validator";

export class JobStatusDto {

    @IsEnum(JobStatus)
    status: JobStatus;

    @IsEnum(SalesmanWorkflowStatus)
    salesmanWorkflowStatus: SalesmanWorkflowStatus
}
