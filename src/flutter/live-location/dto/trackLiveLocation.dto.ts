import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class TrackLiveLocationDto {
    @ApiProperty({ description: 'Latitude coordinate' })
    @IsNumber()
    @IsNotEmpty()
    @Type(() => Number)
    latitude: number;

    @ApiProperty({ description: 'Longitude coordinate' })
    @IsNumber()
    @IsNotEmpty()
    @Type(() => Number)
    longitude: number;

    @ApiPropertyOptional({ description: 'Timestamp of the location update' })
    @IsOptional()
    @IsString()
    timestamp?: string;

    @ApiPropertyOptional({ description: 'User ID for webhook updates' })
    @IsOptional()
    @IsString()
    user_id?: string;

    @ApiPropertyOptional({ description: 'User ID alias for webhook updates' })
    @IsOptional()
    @IsString()
    userId?: string;
}