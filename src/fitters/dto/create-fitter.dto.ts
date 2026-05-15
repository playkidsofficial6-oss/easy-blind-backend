import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { FitterProfileStatus } from '../fitter-status.enum';

export class FitterLocationDto {
  @ApiProperty({ example: 25.2048 })
  @IsNumber()
  lat: number;

  @ApiProperty({ example: 55.2708 })
  @IsNumber()
  lng: number;

  @ApiProperty({ example: 'Downtown Dubai, Dubai, UAE' })
  @IsString()
  @MaxLength(255)
  address: string;
}

export class CreateFitterDto {
  @ApiProperty({
    description: 'MongoDB user id for a registered user with role=fitter',
  })
  @IsMongoId()
  userId: string;

  @ApiPropertyOptional({ example: '+971500000000' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ type: FitterLocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FitterLocationDto)
  location?: FitterLocationDto;

  @ApiPropertyOptional({
    enum: FitterProfileStatus,
    default: FitterProfileStatus.Available,
  })
  @IsOptional()
  @IsEnum(FitterProfileStatus)
  status?: FitterProfileStatus;

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  capacity?: number;

  @ApiPropertyOptional({
    example: ['measurement', 'installation'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional({ example: 'Prefers morning appointments.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
