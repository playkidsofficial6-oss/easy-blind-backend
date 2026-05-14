import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CreateJobDto } from './dto/create-job.dto';
import { QueryJobsDto } from './dto/query-jobs.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JobsService } from './jobs.service';

@ApiTags('jobs')
@Controller({ path: 'jobs', version: '1' })
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new Easy-Blinds job' })
  @ApiCreatedResponse({ description: 'Job created successfully.' })
  create(@Body() createJobDto: CreateJobDto) {
    return this.jobsService.create(createJobDto);
  }

  @Get()
  @ApiOperation({ summary: 'Read jobs with optional filtering and pagination' })
  @ApiOkResponse({ description: 'Jobs returned successfully.' })
  findAll(@Query() query: QueryJobsDto) {
    return this.jobsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read a single job by MongoDB id' })
  @ApiOkResponse({ description: 'Job returned successfully.' })
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.jobsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing job' })
  @ApiOkResponse({ description: 'Job updated successfully.' })
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() updateJobDto: UpdateJobDto,
  ) {
    return this.jobsService.update(id, updateJobDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an existing job' })
  @ApiOkResponse({ description: 'Job deleted successfully.' })
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.jobsService.remove(id);
  }
}
