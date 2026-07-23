import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class FitterWorkflowDto {
  @ApiPropertyOptional({ example: 'user_id_of_fitter' })
  @IsOptional()
  @IsString()
  fitterId?: string;

  @ApiPropertyOptional({ example: 'Fitting completed smoothly.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'URLs of photos uploaded upon fitting completion',
    example: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];
}
