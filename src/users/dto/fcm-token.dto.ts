import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class FcmTokenDto {
  @ApiProperty({ description: 'Device FCM push notification token', example: 'dK8...' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
