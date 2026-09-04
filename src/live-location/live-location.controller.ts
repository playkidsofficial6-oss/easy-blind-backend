import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtAuthenticatedUser } from '../auth/interfaces/jwt-user.interface';
import { UpdateLiveLocationDto } from './dto/update-live-location.dto';
import { LiveLocationService } from './live-location.service';

interface AuthenticatedRequest extends Request {
  user: JwtAuthenticatedUser;
}

@ApiTags('live-location')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('live-location')
export class LiveLocationController {
  constructor(
    private readonly liveLocationService: LiveLocationService,
  ) {}

  @Post('update')
  @ApiOperation({
    summary: 'Update the logged-in salesman or fitter live location',
  })
  @ApiOkResponse({ description: 'Live location updated successfully.' })
  async updateLocation(
    @Req() request: AuthenticatedRequest,
    @Body() updateLiveLocationDto: UpdateLiveLocationDto,
  ) {
    return this.liveLocationService.updateLocation(
      request.user,
      updateLiveLocationDto,
    );
  }

  @Get('all')
  @ApiOperation({
    summary: 'List all live locations for owner and sales manager users',
  })
  @ApiOkResponse({ description: 'Live locations returned successfully.' })
  findAll(@Req() request: AuthenticatedRequest) {
    return this.liveLocationService.findAll(request.user);
  }
}
