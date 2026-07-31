import { IsArray, IsNotEmpty } from 'class-validator';

export class JobPhotosDto {
  @IsArray()
  @IsNotEmpty({ each: true })
  photos: string[];
}
