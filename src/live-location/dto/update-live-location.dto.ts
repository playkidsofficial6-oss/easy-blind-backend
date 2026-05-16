import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class GeoPointDto {
  @ApiProperty({ example: 'Point', enum: ['Point'] })
  @IsEnum(['Point'])
  type: 'Point';

  @ApiProperty({
    example: [76.1199, 11.1203],
    description: '[longitude, latitude]',
    minItems: 2,
    maxItems: 2,
    items: { type: 'number' },
  })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsNumber({}, { each: true })
  coordinates: [number, number]; // [longitude, latitude]
}

export class UpdateLiveLocationDto {
  @ApiProperty({ type: GeoPointDto })
  @IsObject()
  @ValidateNested()
  @Type(() => GeoPointDto)
  location: GeoPointDto;

  @ApiPropertyOptional({ example: 12.5, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;

  @ApiPropertyOptional({ example: 4.2, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  speed?: number;

  @ApiPropertyOptional({ example: 180, minimum: 0, maximum: 360 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(360)
  heading?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;
}
