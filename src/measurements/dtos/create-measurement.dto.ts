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
import { MeasurementStatus, OpeningType } from '../schemas/measurement.schema';

export class OpeningDto {
  @ApiProperty({ example: 'w1' })
  @IsString()
  id: string;

  @ApiProperty({ enum: OpeningType, example: OpeningType.WINDOW })
  @IsEnum(OpeningType)
  type: OpeningType;

  @ApiProperty({ example: 'Window 1' })
  @IsString()
  name: string;

  @ApiProperty({ example: 150 })
  @IsNumber()
  @Min(0.1)
  width: number;

  @ApiProperty({ example: 200 })
  @IsNumber()
  @Min(0.1)
  height: number;

  @ApiPropertyOptional({ example: 'cm' })
  @IsOptional()
  @IsString()
  measurementUnit?: string;

  @ApiProperty({ example: 'Wall' })
  @IsString()
  mountType: string;

  @ApiProperty({ example: 'Split' })
  @IsString()
  openingDirection: string;

  @ApiProperty({ example: 'Sheer Curtains' })
  @IsString()
  productType: string;

  @ApiProperty({ example: 'aluminum' })
  @IsString()
  materialType: string;

  @ApiPropertyOptional({ example: 'Custom Pine Wood' })
  @IsOptional()
  @IsString()
  customMaterial?: string;

  @ApiProperty({ example: 'Manual' })
  @IsString()
  motorType: string;

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
  @IsString()
  category: string;

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

  @ApiProperty({ example: 'salesman_id_123' })
  @IsString()
  assignedStaff: string;

  @ApiProperty({ example: '2026-05-20T10:00:00.000Z' })
  @IsDateString()
  visitDate: string;

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
