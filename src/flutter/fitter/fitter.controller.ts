import { Body, Controller, ForbiddenException, Get, Param, Patch, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FitterService } from './fitter.service';
import { AuthUser } from '../../helpers/AuthUser.type';
import { MyJobsFilterDto } from './dto/my-job-filter.dto';
import { JobStatusDto } from '../sales-man/dto/job-status-change.dto';
import { CancelJobDto } from '../sales-man/dto/cancel-job.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UserRole } from '../../users/schemas/user.schema';
import { HomeDto } from './dto/home.dto';
import { CompletedJobsDto } from './dto/completed-jobs.dto';

@ApiTags('flutter-fitter')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('flutter/fitter')
export class FitterController {
  constructor(private readonly fitterService: FitterService) { }

  @Get("home")
  @ApiOperation({ summary: 'Get fitter dashboard home data' })
  async home(@Request() { user }: { user: AuthUser }, @Query() dto: HomeDto): Promise<any> {
    if (user.role !== UserRole.Fitter) {
      throw new ForbiddenException("You are not authorized to access this route");
    }
    return await this.fitterService.home(user.userId, dto);
  }

  @Get("my-jobs")
  @ApiOperation({ summary: 'Get list of jobs assigned to logged-in fitter' })
  async myJobs(@Request() { user }: { user: AuthUser }, @Query() query: MyJobsFilterDto): Promise<any> {
    if (user.role !== UserRole.Fitter) {
      throw new ForbiddenException("You are not authorized to access this route");
    }
    return await this.fitterService.myJobs(user.userId, query);
  }

  @Get("job/completed")
  @ApiOperation({ summary: 'Get list of completed jobs for logged-in fitter' })
  async completedJobs(@Request() { user }: { user: AuthUser }, @Query() dto: CompletedJobsDto): Promise<any> {
    if (user.role !== UserRole.Fitter) {
      throw new ForbiddenException("You are not authorized to access this route");
    }
    return await this.fitterService.completedJobs(user.userId, dto);
  }

  @Get("job/:id")
  @ApiOperation({ summary: 'Get job details by ID for fitter' })
  async getJobById(@Request() { user }: { user: AuthUser }, @Param("id") id: string): Promise<any> {
    if (user.role !== UserRole.Fitter) {
      throw new ForbiddenException("You are not authorized to access this route");
    }
    return await this.fitterService.getJobById(user.userId, id);
  }

  @Patch("job/:jobId/status")
  @ApiOperation({ summary: 'Update job status by fitter' })
  async jobStatus(@Request() { user }: { user: AuthUser }, @Param("jobId") jobId: string, @Body() body: JobStatusDto): Promise<any> {
    if (user.role !== UserRole.Fitter) {
      throw new ForbiddenException("You are not authorized to access this route");
    }
    return await this.fitterService.jobStatus(user.userId, jobId, body);
  }

  @Patch("job/cancel/:jobId")
  @ApiOperation({ summary: 'Cancel a job by fitter' })
  async cancelJob(@Request() { user }: { user: AuthUser }, @Param("jobId") jobId: string, @Body() dto: CancelJobDto) {
    if (user.role !== UserRole.Fitter) {
      throw new ForbiddenException("You are not authorized to access this route");
    }
    return await this.fitterService.cancelJob(user.userId, jobId, dto);
  }
}
