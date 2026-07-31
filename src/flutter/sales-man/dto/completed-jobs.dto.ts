import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsPositive } from 'class-validator';

export class CompletedJobsDto {
  @ApiPropertyOptional()
  @IsPositive()
  @IsInt()
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional()
  @IsPositive()
  @IsInt()
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  limit?: number = 10;
}
