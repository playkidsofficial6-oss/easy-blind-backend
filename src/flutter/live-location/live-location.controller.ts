import { Controller, UseGuards } from '@nestjs/common';
import { LiveLocationService } from './live-location.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiTags('flutter-live-location')
@Controller('flutter/live-location')
export class LiveLocationController {
  constructor(private readonly liveLocationService: LiveLocationService) { }
}

