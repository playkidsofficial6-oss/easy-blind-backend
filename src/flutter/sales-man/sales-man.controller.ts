import { Body, Controller, ForbiddenException, Get, Param, Patch, Query, Request, UseGuards } from '@nestjs/common';
import { SalesManService } from './sales-man.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/helpers/AuthUser.type';
import { UserRole } from 'src/users/schemas/user.schema';
import { MyJobsFilterDto } from './dto/my-job-filter.dto';
import { JobStatusDto } from './dto/job-status-change.dto';


@UseGuards(JwtAuthGuard)
@Controller('flutter/sales-man')
export class SalesManController {
  constructor(private readonly salesManService: SalesManService) { }

  @Get("home")
  async home(@Request() { user }: { user: AuthUser }): Promise<any> {
    if (user.role !== UserRole.Salesman) {
      throw new ForbiddenException("You are not authorized to access this route")
    }
    return await this.salesManService.home(user.userId);
  }

  @Get("my-jobs")
  async myJobs(@Request() { user }: { user: AuthUser }, @Query() query: MyJobsFilterDto): Promise<any> {
    if (user.role !== UserRole.Salesman) {
      throw new ForbiddenException("You are not authorized to access this route")
    }
    return await this.salesManService.myJobs(user.userId, query);
  }

  @Get("job/:id")
  async getJobById(@Request() { user }: { user: AuthUser }, @Param("id") id: string): Promise<any> {
    if (user.role !== UserRole.Salesman) {
      throw new ForbiddenException("You are not authorized to access this route")
    }
    return await this.salesManService.getJobById(user.userId, id);
  }

  @Patch("job/:jobId/status")
  async jobStatus(@Request() { user }: { user: AuthUser }, @Param("jobId") jobId: string, @Body() body: JobStatusDto): Promise<any> {
    if (user.role !== UserRole.Salesman) {
      throw new ForbiddenException("You are not authorized to access this route")
    }
    return await this.salesManService.jobStatus(user.userId, jobId, body);
  }

  @Patch("job/cancel/:jobId")
  async cancelJob(@Param("jobId") jobId: string, @Body() dto: { reason: string }) {
    return await this.salesManService.cancelJob(jobId, dto);
  }
}
