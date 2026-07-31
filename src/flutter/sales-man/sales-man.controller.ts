import { Body, Controller, ForbiddenException, Get, Param, Patch, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SalesManService } from './sales-man.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuthUser } from '../../helpers/AuthUser.type';
import { UserRole } from '../../users/schemas/user.schema';
import { MyJobsFilterDto } from './dto/my-job-filter.dto';
import { JobStatusDto } from './dto/job-status-change.dto';
import { CancelJobDto } from './dto/cancel-job.dto';
import { HomeDto } from './dto/home.dto';
import { CompletedJobsDto } from './dto/completed-jobs.dto';

@ApiTags('flutter-salesman')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('flutter/sales-man')
export class SalesManController {
  constructor(private readonly salesManService: SalesManService) { }

  @Get("home")
  @ApiOperation({ summary: 'Get salesman dashboard home data' })
  async home(@Request() { user }: { user: AuthUser }, @Query() dto: HomeDto): Promise<any> {
    if (user.role !== UserRole.Salesman) {
      throw new ForbiddenException("You are not authorized to access this route")
    }
    return await this.salesManService.home(user.userId, dto);
  }

  @Get("my-jobs")
  @ApiOperation({ summary: 'Get list of jobs assigned to logged-in salesman' })
  async myJobs(@Request() { user }: { user: AuthUser }, @Query() query: MyJobsFilterDto): Promise<any> {
    if (user.role !== UserRole.Salesman) {
      throw new ForbiddenException("You are not authorized to access this route")
    }
    return await this.salesManService.myJobs(user.userId, query);
  }


  @Get("job/completed")
  @ApiOperation({ summary: 'Get list of completed jobs for logged-in salesman' })
  async completedJobs(@Request() { user }: { user: AuthUser }, @Query() dto: CompletedJobsDto): Promise<any> {
    if (user.role !== UserRole.Salesman) {
      throw new ForbiddenException("You are not authorized to access this route")
    }
    return await this.salesManService.completedJobs(user.userId, dto);
  }

  @Get("job/:id")
  @ApiOperation({ summary: 'Get job details by ID for salesman' })
  async getJobById(@Request() { user }: { user: AuthUser }, @Param("id") id: string): Promise<any> {
    if (user.role !== UserRole.Salesman) {
      throw new ForbiddenException("You are not authorized to access this route")
    }
    return await this.salesManService.getJobById(user.userId, id);
  }

  @Patch("job/:jobId/status")
  @ApiOperation({ summary: 'Update job status by salesman' })
  async jobStatus(@Request() { user }: { user: AuthUser }, @Param("jobId") jobId: string, @Body() body: JobStatusDto): Promise<any> {
    if (user.role !== UserRole.Salesman) {
      throw new ForbiddenException("You are not authorized to access this route")
    }
    return await this.salesManService.jobStatus(user.userId, jobId, body);
  }

  @Patch("job/cancel/:jobId")
  @ApiOperation({ summary: 'Cancel a job by salesman' })
  async cancelJob(@Request() { user }: { user: AuthUser }, @Param("jobId") jobId: string, @Body() dto: CancelJobDto) {
    if (user.role !== UserRole.Salesman) {
      throw new ForbiddenException("You are not authorized to access this route");
    }
    return await this.salesManService.cancelJob(user.userId, jobId, dto);
  }



}
