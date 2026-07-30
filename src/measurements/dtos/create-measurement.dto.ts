import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OpeningType } from '../../jobs/schemas/job.schema';

export enum MeasurementStatus {
  PENDING = 'Pending',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
  DRAFT = 'Draft',
}

export class OpeningDto {
  @ApiProperty({ example: 'w1' })
  @IsString()
  id: string;

  @ApiProperty({ enum: OpeningType, example: OpeningType.WINDOW })
  @IsEnum(OpeningType)
  type: OpeningType;

  @ApiProperty({ example: 'Window 1' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 150 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  width?: number;

  @ApiProperty({ example: 200 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  height?: number;

  @ApiPropertyOptional({ example: 'cm' })
  @IsOptional()
  @IsString()
  measurementUnit?: string;

  @ApiPropertyOptional({ example: 'Wall' })
  @IsOptional()
  @IsString()
  mountType?: string;

  @ApiPropertyOptional({ example: 'Split' })
  @IsOptional()
  @IsString()
  openingDirection?: string;

  @ApiPropertyOptional({ example: 'Sheer Curtains' })
  @IsOptional()
  @IsString()
  productType?: string;

  @ApiPropertyOptional({ example: 'aluminum' })
  @IsOptional()
  @IsString()
  materialType?: string;

  @ApiPropertyOptional({ example: 'Custom Pine Wood' })
  @IsOptional()
  @IsString()
  customMaterial?: string;

  @ApiPropertyOptional({ example: 'Manual' })
  @IsOptional()
  @IsString()
  motorType?: string;

  @ApiPropertyOptional({ example: 'Double height glass window' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class RoomDto {
  @ApiProperty({ example: 'r1' })
  @IsString()
  id: string;

  @ApiProperty({ example: 'Master Bedroom' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Bedroom' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ type: [OpeningDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpeningDto)
  openings: OpeningDto[];
}

export class CreateMeasurementDto {
  @ApiProperty({ example: 'job_id_123' })
  @IsString()
  jobId: string;

  @ApiProperty({ example: '2026-05-20T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  visitDate?: string;

  @ApiPropertyOptional({
    enum: MeasurementStatus,
    default: MeasurementStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(MeasurementStatus)
  status?: MeasurementStatus;

  @ApiProperty({ type: [RoomDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoomDto)
  rooms: RoomDto[];
}
