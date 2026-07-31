import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsObject,
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
}
