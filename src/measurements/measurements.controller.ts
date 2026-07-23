import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MeasurementsService } from './measurements.service';
import { CreateMeasurementDto } from './dtos/create-measurement.dto';
import { UpdateMeasurementDto } from './dtos/update-measurement.dto';

@ApiTags('Measurements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('measurements')
export class MeasurementsController {
  constructor(private readonly measurementsService: MeasurementsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new measurement record' })
  async create(@Body() createDto: CreateMeasurementDto) {
    return this.measurementsService.createMeasurement(createDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing measurement record by ID' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateMeasurementDto,
  ) {
    return this.measurementsService.updateMeasurement(id, updateDto);
  }

  @Get('job/:jobId')
  @ApiOperation({ summary: 'Retrieve measurement details by Job ID' })
  async getByJob(@Param('jobId') jobId: string) {
    return this.measurementsService.getMeasurementByJobId(jobId);
  }

  @Get('staff/:staffId')
  @ApiOperation({ summary: 'Retrieve measurements assigned to a staff member' })
  async getByStaff(@Param('staffId') staffId: string) {
    return this.measurementsService.getMeasurementsByStaff(staffId);
  }

  @Get(':id/summary')
  @ApiOperation({
    summary: 'Retrieve a quick statistical summary of a measurement',
  })
  async getSummary(@Param('id') id: string) {
    return this.measurementsService.getMeasurementSummary(id);
  }
}
