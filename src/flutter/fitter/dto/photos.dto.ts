import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class JobPhotosDto {
  @IsArray()
  @IsNotEmpty({ each: true })
  photos: string[];

  @IsString()
  @IsOptional()
  remarks?: string;
}
