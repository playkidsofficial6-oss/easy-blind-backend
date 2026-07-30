import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsIn, IsOptional } from "class-validator";
import { JobPriority, JobStatus, PropertyType } from "../../../jobs/schemas/job.schema";

export class MyJobsFilterDto {
    @ApiPropertyOptional({ example: "abc", description: "Search query" })
    @IsOptional()
    q?: string


    @ApiPropertyOptional({ example: "All", description: "Date range filter" })
    @IsEnum(["All", "Today", "Tomorrow", "Yesterday", "Week", "Month"])
    @IsOptional()
    date?: "All" | "Today" | "Tomorrow" | "Yesterday" | "Week" | "Month" = "All";

    @ApiPropertyOptional({ enum: JobStatus, description: "Job status filter" })
    @IsEnum(JobStatus)
    @IsOptional()
    status?: JobStatus;

    @ApiPropertyOptional({ enum: JobPriority, description: "Job priority filter" })
    @IsEnum(JobPriority)
    @IsOptional()
    priority?: JobPriority;

    @ApiPropertyOptional({ example: "Villa", description: "Property type filter" })
    @IsEnum(PropertyType)
    @IsOptional()
    propertyType?: PropertyType;
}

