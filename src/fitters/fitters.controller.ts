import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FittersService } from './fitters.service';

@ApiTags('fitters')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fitters')
export class FittersController {
  constructor(private readonly fittersService: FittersService) {}

  @Get()
  @ApiOperation({ summary: 'List all fitters' })
  @ApiOkResponse({ description: 'Fitters returned successfully.' })
  findAll() {
    return this.fittersService.findAll();
  }
}
