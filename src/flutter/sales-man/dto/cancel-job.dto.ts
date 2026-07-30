import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CancelJobDto {
  @ApiProperty({
    description: 'Reason for cancelling the job',
    example: 'Customer requested cancellation due to scheduling conflict',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(1000)
  reason: string;
}
