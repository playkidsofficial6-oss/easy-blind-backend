import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SalesmanWorkflowDto {
  @ApiPropertyOptional({ example: 'user_id_of_salesman' })
  @IsOptional()
  @IsString()
  salesmanId?: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  salesmanName?: string;

  @ApiPropertyOptional({ example: 'Travel and measurement time log.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
