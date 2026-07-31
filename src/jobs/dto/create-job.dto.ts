import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { JobPriority, JobStatus } from '../schemas/job.schema';

export class CreateJobDto {
  @ApiProperty({ example: 'Aarav' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  firstName: string;

  @ApiProperty({ example: 'Sharma' })
  @IsString()
  @IsOptional()
  @MaxLength(60)
  lastName: string;

  @ApiPropertyOptional({ example: 'aarav@example.com' })
  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @IsOptional()
  customerPhone?: string;

  @ApiProperty({ example: '12 MG Road, Bengaluru, Karnataka' })
  @IsString()
  @MinLength(5)
  @MaxLength(250)
  address: string;

  @ApiPropertyOptional({ example: 'Motorized Blinds' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  productType?: string;

  @ApiPropertyOptional({ example: 'Villa' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  propertyType?: string;

  @ApiPropertyOptional({ example: 4, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ example: 5000, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  projectValue?: number;

  @ApiPropertyOptional({ enum: JobStatus, default: JobStatus.Pending })
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;

  @ApiPropertyOptional({ enum: JobPriority, default: JobPriority.Medium })
  @IsOptional()
  @IsEnum(JobPriority)
  priority?: JobPriority;

  @ApiPropertyOptional({ example: 'Customer prefers afternoon appointment.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({ example: '2026-05-20T10:30:00.000Z' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ example: 'user_id_of_sales_manager' })
  @IsOptional()
  @IsString()
  assignedSalesManager?: string;

  @ApiPropertyOptional({ example: 'user_id_of_salesman' })
  @IsOptional()
  @IsString()
  assignedSalesman?: string;

  @ApiPropertyOptional({ example: '2026-05-20T10:30:00.000Z' })
  @IsOptional()
  @IsDateString()
  measurementCompletedAt?: string;

  @ApiPropertyOptional({ example: 'user_id_of_fitter' })
  @IsOptional()
  @IsString()
  assignedFitter?: string;

  @ApiPropertyOptional()
  @IsOptional()
  quotation?: any;

  @ApiPropertyOptional()
  @IsOptional()
  location?: {
    type: string;
    coordinates: number[];
  };

  @ApiPropertyOptional()
  @IsOptional()
  rescheduleRequest?: {
    status: 'pending' | 'resolved';
    requestedAt: string;
  };
}
