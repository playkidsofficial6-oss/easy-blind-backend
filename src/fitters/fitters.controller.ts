import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CreateFitterDto } from './dto/create-fitter.dto';
import { UpdateFitterDto } from './dto/update-fitter.dto';
import { FittersService } from './fitters.service';

@ApiTags('fitters')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fitters')
export class FittersController {
  constructor(private readonly fittersService: FittersService) {}

  @Get()
  @ApiOperation({
    summary: 'List fitter users merged with dedicated fitter profiles',
  })
  @ApiOkResponse({ description: 'Fitters returned successfully.' })
  findAll() {
    return this.fittersService.findAll();
  }
  @Get(':userId')
  @ApiOperation({ summary: 'Read a fitter profile by linked user id' })
  @ApiOkResponse({ description: 'Fitter returned successfully.' })
  findOne(@Param('userId', ParseObjectIdPipe) userId: string) {
    return this.fittersService.findByUserId(userId);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a dedicated fitter profile for a role=fitter user',
  })
  @ApiCreatedResponse({ description: 'Fitter profile created successfully.' })
  create(@Body() createFitterDto: CreateFitterDto) {
    return this.fittersService.create(createFitterDto);
  }

  @Patch(':userId')
  @ApiOperation({
    summary: 'Update or create a fitter profile by linked user id',
  })
  @ApiOkResponse({ description: 'Fitter profile updated successfully.' })
  update(
    @Param('userId', ParseObjectIdPipe) userId: string,
    @Body() updateFitterDto: UpdateFitterDto,
  ) {
    return this.fittersService.upsertByUserId(userId, updateFitterDto);
  }
}
