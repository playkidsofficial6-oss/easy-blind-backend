import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class JobPhotosDto {
  @ApiProperty({ type: [String], description: 'Job photos' })
  @IsArray()
  @IsNotEmpty({ each: true })
  photos: string[];

  @ApiProperty({ type: String, description: 'Job remarks' })
  @IsString()
  @IsOptional()
  remarks?: string;
}
