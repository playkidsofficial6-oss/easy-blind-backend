import { Controller } from '@nestjs/common';
import { LiveLocationService } from './live-location.service';

@Controller('flutter/live-location')
export class LiveLocationController {
  constructor(private readonly liveLocationService: LiveLocationService) { }
}
