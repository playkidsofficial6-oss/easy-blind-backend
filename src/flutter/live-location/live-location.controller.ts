import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { LiveLocationService } from './live-location.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TrackLiveLocationDto } from './dto/trackLiveLocation.,dto';
import { AuthUser } from 'src/helpers/AuthUser.type';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiTags('flutter-live-location')
@Controller('flutter/live-location')
export class LiveLocationController {
  constructor(private readonly liveLocationService: LiveLocationService) { }

  @Post()
  async trackLiveLocation(@Body() dto: TrackLiveLocationDto, @Request() { user }: { user: AuthUser }) {
    return this.liveLocationService.trackLiveLocation(user, dto);
  }
}
