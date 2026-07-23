import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '../schemas/user.schema';
import type { LiveUserStatus } from '../schemas/user.schema';

export class UserLocationDto {
  @ApiProperty({ example: 25.2048 })
  @IsNumber()
  lat: number;

  @ApiProperty({ example: 55.2708 })
  @IsNumber()
  lng: number;

  @ApiPropertyOptional({ example: 'Downtown Dubai' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;
}

export class CreateUserDto {
  @ApiProperty({ example: 'Aarav Sharma' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'aarav@example.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'password must contain at least one letter and one number',
  })
  password: string;

  @ApiPropertyOptional({ enum: UserRole, example: UserRole.User })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ example: '+971 50 123 4567' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar?: string;

  @ApiPropertyOptional({
    enum: [
      'Available',
      'On the way',
      'In progress',
      'Completed',
      'Offline',
      'Fully Booked',
    ],
    example: 'Available',
  })
  @IsOptional()
  @IsEnum([
    'Available',
    'On the way',
    'In progress',
    'Completed',
    'Offline',
    'Fully Booked',
  ] as LiveUserStatus[])
  liveStatus?: LiveUserStatus;

  @ApiPropertyOptional({ type: UserLocationDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UserLocationDto)
  location?: UserLocationDto;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  maxDailyJobs?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  checkedIn?: boolean;
}
