import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'aarav@example.com' })
  @IsEmail({}, {
    message: "Please enter a valid email address.",
  })
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8,
    {
      message: "Password must be at least 8 characters long",
    })
  password: string;
}
