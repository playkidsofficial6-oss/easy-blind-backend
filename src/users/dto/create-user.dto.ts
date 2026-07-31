import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '../schemas/user.schema';

export class UserLocationDto {
  @ApiProperty({ example: 25.2048 })
  @IsNumber()
  lat: number;

  @ApiProperty({ example: 55.2708 })
  @IsNumber()
  lng: number;
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

  @ApiPropertyOptional({ type: UserLocationDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UserLocationDto)
  location?: UserLocationDto;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  checkedIn?: boolean;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @IsString()
  @Matches(/^\+\d{7,15}$/, {
    message: 'Phone number must include country code (e.g. +91, +957)',
  })
  phoneNumber?: string;
}
