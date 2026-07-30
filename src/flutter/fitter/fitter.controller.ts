import { Body, Controller, ForbiddenException, Get, Param, Patch, Query, Request, UseGuards } from '@nestjs/common';
import { FitterService } from './fitter.service';
import { AuthUser } from '../../helpers/AuthUser.type';
import { MyJobsFilterDto } from './dto/my-job-filter.dto';
import { JobStatusDto } from '../sales-man/dto/job-status-change.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UserRole } from '../../users/schemas/user.schema';

@UseGuards(JwtAuthGuard)
@Controller('flutter/fitter')
export class FitterController {
  constructor(private readonly fitterService: FitterService) { }

  @Get("home")
  async home(@Request() { user }: { user: AuthUser }): Promise<any> {
    if (user.role !== UserRole.Fitter) {
      throw new ForbiddenException("You are not authorized to access this route");
    }
    return await this.fitterService.home(user.userId);
  }

  @Get("my-jobs")
  async myJobs(@Request() { user }: { user: AuthUser }, @Query() query: MyJobsFilterDto): Promise<any> {
    if (user.role !== UserRole.Fitter) {
      throw new ForbiddenException("You are not authorized to access this route");
    }
    return await this.fitterService.myJobs(user.userId, query);
  }

  @Get("job/:id")
  async getJobById(@Request() { user }: { user: AuthUser }, @Param("id") id: string): Promise<any> {
    if (user.role !== UserRole.Fitter) {
      throw new ForbiddenException("You are not authorized to access this route");
    }
    return await this.fitterService.getJobById(user.userId, id);
  }

  @Patch("job/:jobId/status")
  async jobStatus(@Request() { user }: { user: AuthUser }, @Param("jobId") jobId: string, @Body() body: JobStatusDto): Promise<any> {
    if (user.role !== UserRole.Fitter) {
      throw new ForbiddenException("You are not authorized to access this route");
    }
    return await this.fitterService.jobStatus(user.userId, jobId, body);
  }

  @Patch("job/cancel/:jobId")
  async cancelJob(@Request() { user }: { user: AuthUser }, @Param("jobId") jobId: string, @Body() dto: { reason: string }) {
    if (user.role !== UserRole.Fitter) {
      throw new ForbiddenException("You are not authorized to access this route");
    }
    return await this.fitterService.cancelJob(user.userId, jobId, dto);
  }
}
