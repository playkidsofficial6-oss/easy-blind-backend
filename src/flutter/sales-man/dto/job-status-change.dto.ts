import { ApiProperty } from "@nestjs/swagger";
import { JobStatus } from "../../../jobs/schemas/job.schema";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class JobStatusDto {
    @ApiProperty({
        enum: JobStatus,
        description: 'New status for the job',
        example: JobStatus.SalesmanOnTheWay,
    })
    @IsEnum(JobStatus)
    status: JobStatus;

    @ApiProperty({
        description: 'Note added by customer',
        type: 'string',
        required: false,
        example: 'Customer wants extra discount',
    })
    @IsString()
    @IsOptional()
    customerNote?: string
}
