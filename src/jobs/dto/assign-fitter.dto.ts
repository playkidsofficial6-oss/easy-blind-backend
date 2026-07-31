import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AssignFitterDto {
  @ApiProperty({
    description: 'User ID of the assigned fitter',
    example: '60d5ec49f1b2c81234567890',
  })
  @IsString()
  @IsNotEmpty()
  fitterId: string;
}
