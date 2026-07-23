import { IsEnum, IsIn, IsOptional } from "class-validator";
import { JobPriority, JobStatus } from "src/jobs/schemas/job.schema";

export class MyJobsFilterDto {

    @IsIn(["All", "Today", "Tomorrow", "Yesterday", "Week", "Month"])
    @IsOptional()
    date?: string = "All";

    @IsEnum(JobStatus)
    @IsOptional()
    status?: JobStatus;

    @IsEnum(JobPriority)
    @IsOptional()
    priority?: JobPriority;

    @IsIn(['Villa', 'Apartment', 'Townhouse', 'Office', 'Other'])
    @IsOptional()
    propertyType?: "Villa" | "Apartment" | "Townhouse" | "Office" | "Other";


}

