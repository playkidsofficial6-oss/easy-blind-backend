import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsNotEmpty, IsNumber, IsOptional } from "class-validator";

export class TrackLiveLocationDto {
    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    @Type(() => Number)
    latitude: number;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    @Type(() => Number)
    longitude: number;


    @IsOptional()
    timestamp?: string;

    @IsOptional()
    user_id?: string


}