import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model, Types } from 'mongoose';
import { Job, JobDocument, JobStatus } from '../../jobs/schemas/job.schema';
import { MyJobsFilterDto } from './dto/my-job-filter.dto';
import { JobStatusDto } from './dto/job-status-change.dto';
import { HomeDto } from './dto/home.dto';
import { CompletedJobsDto } from './dto/completed-jobs.dto';

@Injectable()
export class SalesManService {
  constructor(
    @InjectModel(Job.name) private readonly jobModel: Model<JobDocument>,
  ) { }

  async home(
    assignedSalesman: mongoose.Types.ObjectId | string,
    dto: HomeDto,
  ): Promise<HomeResponseType> {
    const page = dto?.page ?? 1;
    const limit = dto?.limit ?? 10;
    const salesmanFilter = {
      assignedSalesman: assignedSalesman,
    };

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );

    const startOfTomorrow = new Date(
      startOfToday.getTime() + 24 * 60 * 60 * 1000,
    );
    const endOfTomorrow = new Date(endOfToday.getTime() + 24 * 60 * 60 * 1000);

    const jobs = await this.jobModel
      .find({
        ...salesmanFilter,
        scheduledAt: { $gte: startOfToday, $lte: endOfToday },
        status: {
          $in: [
            JobStatus.SalesmanScheduled,
            JobStatus.SalesmanOnTheWay,
            JobStatus.FitterReached,
            JobStatus.Measuring,
            JobStatus.Quoting,
          ],
        },
      })
      .populate('assignedSalesManager', 'name email role phone checkedIn')
      .populate('assignedSalesman', 'name email role phone checkedIn')
      .populate('assignedFitter', 'name email role phone checkedIn')
      .sort({ scheduledAt: 1, createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    const todayJobs: JobDocument[] = jobs;
    let tommorow = 0;
    let upcoming = 0;
    let completed = 0;
    let cancelled = 0;

    tommorow = await this.jobModel
      .countDocuments({
        ...salesmanFilter,
        status: JobStatus.SalesmanScheduled,
        scheduledAt: { $gte: startOfTomorrow, $lte: endOfTomorrow },
      })
      .exec();
    upcoming = await this.jobModel
      .countDocuments({
        ...salesmanFilter,
        status: JobStatus.SalesmanScheduled,
        scheduledAt: { $gte: startOfToday, $lte: endOfToday },
      })
      .exec();
    completed = await this.jobModel
      .countDocuments({
        ...salesmanFilter,
        status: {
          $in: [
            JobStatus.ReadyForFitting,
            JobStatus.FitterAssigned,
            JobStatus.FitterOnTheWay,
            JobStatus.FitterReached,
            JobStatus.FitterCancelled,
            JobStatus.Fitting,
            JobStatus.TakingPhotos,
            JobStatus.Completed,
          ],
        },
      })
      .exec();
    cancelled = await this.jobModel
      .countDocuments({
        ...salesmanFilter,
        status: { $in: [JobStatus.SalesmanCancelled] },
      })
      .exec();

    const pagination = {
      page,
      limit,
      totalData: await this.jobModel.countDocuments({
        ...salesmanFilter,
        scheduledAt: { $gte: startOfToday, $lte: endOfToday },
        status: {
          $in: [
            JobStatus.SalesmanScheduled,
            JobStatus.SalesmanOnTheWay,
            JobStatus.FitterReached,
            JobStatus.Measuring,
            JobStatus.Quoting,
          ],
        },
      }),
      totalPages: Math.ceil(
        (await this.jobModel.countDocuments({
          ...salesmanFilter,
          scheduledAt: { $gte: startOfToday, $lte: endOfToday },
          status: {
            $in: [
              JobStatus.SalesmanScheduled,
              JobStatus.SalesmanOnTheWay,
              JobStatus.FitterReached,
              JobStatus.Measuring,
              JobStatus.Quoting,
            ],
          },
        })) / limit,
      ),
    };

    return {
      message: 'All home page datas are fetched successfully',
      data: {
        tommorow,
        upcoming,
        completed,
        cancelled,
        todayJobs,
      },
      pagination,
    };
  }

  async myJobs(
    assignedSalesman: mongoose.Types.ObjectId | string,
    query: MyJobsFilterDto,
  ): Promise<MyJobResponseType> {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 10;
    const mongoQuery: any = { assignedSalesman: assignedSalesman };

    if (query?.status) {
      mongoQuery.status = query.status;
    } else {
      mongoQuery.status = {
        $in: [
          JobStatus.SalesmanScheduled,
          JobStatus.SalesmanOnTheWay,
          JobStatus.FitterReached,
          JobStatus.Measuring,
          JobStatus.Quoting,
        ],
      };
    }
    if (query?.priority) {
      mongoQuery.priority = query.priority;
    }

    if (query?.propertyType) {
      mongoQuery.propertyType = query.propertyType;
    }

    if (query?.q) {
      mongoQuery.$or = [
        {
          firstName: {
            $regex: query.q,
            $options: 'i',
          },
        },
        {
          lastName: {
            $regex: query.q,
            $options: 'i',
          },
        },
        {
          address: {
            $regex: query.q,
            $options: 'i',
          },
        },
      ];
    }

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );

    const startOfTomorrow = new Date(
      startOfToday.getTime() + 24 * 60 * 60 * 1000,
    );
    const endOfTomorrow = new Date(endOfToday.getTime() + 24 * 60 * 60 * 1000);

    const startOfWeek = new Date(
      startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000,
    );
    const endOfWeek = new Date(endOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

    const startOfMonth = new Date(
      startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000,
    );
    const endOfMonth = new Date(
      endOfToday.getTime() + 30 * 24 * 60 * 60 * 1000,
    );

    const startOfYesterday = new Date(
      startOfToday.getTime() - 24 * 60 * 60 * 1000,
    );
    const endOfYesterday = new Date(endOfToday.getTime() - 24 * 60 * 60 * 1000);

    if (query.date === 'Today') {
      mongoQuery.scheduledAt = { $gte: startOfToday, $lte: endOfToday };
    }
    if (query.date === 'Tomorrow') {
      mongoQuery.scheduledAt = { $gte: startOfTomorrow, $lte: endOfTomorrow };
    }
    if (query.date === 'Yesterday') {
      mongoQuery.scheduledAt = { $gte: startOfYesterday, $lte: endOfYesterday };
    }
    if (query.date === 'Week') {
      mongoQuery.scheduledAt = { $gte: startOfWeek, $lte: endOfWeek };
    }
    if (query.date === 'Month') {
      mongoQuery.scheduledAt = { $gte: startOfMonth, $lte: endOfMonth };
    }

    const jobs = await this.jobModel
      .find(mongoQuery)
      .populate('assignedSalesManager', 'name email role phone checkedIn')
      .populate('assignedSalesman', 'name email role phone checkedIn')
      .populate('assignedFitter', 'name email role phone checkedIn')
      .sort({ scheduledAt: 1, createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    const pagination = {
      page,
      limit,
      totalData: await this.jobModel.countDocuments(mongoQuery),
      totalPages: Math.ceil(
        (await this.jobModel.countDocuments(mongoQuery)) / limit,
      ),
    };

    return {
      message: 'My job page datas are fetched successfully',
      data: jobs,
      pagination,
    };
  }

  async jobStatus(
    salesmanId: mongoose.Types.ObjectId | string,
    jobId: string,
    dto: JobStatusDto,
  ) {
    if (!Types.ObjectId.isValid(jobId)) {
      throw new BadRequestException('Invalid job ID');
    }

    const job = await this.jobModel.findOne({
      _id: new Types.ObjectId(jobId),
      assignedSalesman: salesmanId,
    });

    if (!job) {
      throw new NotFoundException('Job not found or not assigned to you');
    }
    job.status = dto.status;
    job.customerNote = dto.customerNote;

    const now = new Date();

    switch (job.status) {
      case JobStatus.SalesmanOnTheWay:
        job.salemanStartedJourneyAt = now;
        break;

      case JobStatus.SalesmanReached:
        job.salemanReachedAtDate = now;
        break;

      case JobStatus.Measuring:
        job.salemanReachedAtDate ??= now;
        job.salemanMeasuringStartedAt = now;
        break;

      case JobStatus.Quoting:
        job.salemanMeasuringCompletedAt = now;
        break;

      case JobStatus.ReadyForFitting:
        job.salemanMeasuringCompletedAt ??= now;
        job.salemanJobCompletedAt = now;
        break;
    }
    await job.save();
    return {
      message: 'Job status updated successfully',
      data: job,
    };
  }

  async cancelJob(
    salesmanId: mongoose.Types.ObjectId | string,
    jobId: string,
    dto: { reason: string },
  ) {
    if (!Types.ObjectId.isValid(jobId)) {
      throw new BadRequestException('Invalid job ID');
    }

    const job = await this.jobModel.findOne({
      _id: new Types.ObjectId(jobId),
      assignedSalesman: salesmanId,
    });

    if (!job) {
      throw new NotFoundException('Job not found or not assigned to you');
    }
    job.status = JobStatus.SalesmanCancelled;
    job.rescheduleRequest = { status: 'pending', requestedAt: new Date() };
    job.cancelReason = dto.reason;
    await job.save();
    return {
      message: 'Job cancelled successfully',
      data: job,
    };
  }

  async getJobById(
    salesmanId: mongoose.Types.ObjectId | string,
    jobId: string,
  ) {
    const isHexId = Types.ObjectId.isValid(jobId);
    if (!isHexId) {
      throw new BadRequestException('Invalid job ID');
    }
    const jobObjectId = new Types.ObjectId(jobId);

    const job = await this.jobModel
      .findOne({
        _id: jobObjectId,
        assignedSalesman: salesmanId,
      })
      .populate('assignedSalesManager', 'name email role phone checkedIn')
      .populate('assignedSalesman', 'name email role phone checkedIn')
      .populate('assignedFitter', 'name email role phone checkedIn')
      .exec();

    if (!job) {
      throw new NotFoundException('Job not found or not assigned to you');
    }

    return {
      message: 'Job details fetched successfully',
      data: job,
    };
  }

  async completedJobs(
    user: mongoose.Types.ObjectId | string,
    dto: CompletedJobsDto,
  ) {
    const page = dto?.page ?? 1;
    const limit = dto?.limit ?? 10;
    const jobs = await this.jobModel
      .find({
        assignedSalesman: user,
        status: {
          $in: [
            JobStatus.ReadyForFitting,
            JobStatus.FitterAssigned,
            JobStatus.FitterOnTheWay,
            JobStatus.FitterReached,
            JobStatus.FitterCancelled,
            JobStatus.Fitting,
            JobStatus.TakingPhotos,
            JobStatus.Completed,
          ],
        },
      })
      .populate('assignedSalesManager', 'name email role phone checkedIn')
      .populate('assignedSalesman', 'name email role phone checkedIn')
      .populate('assignedFitter', 'name email role phone checkedIn')
      .sort({ scheduledAt: 1, createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    const pagination = {
      page,
      limit,
      totalData: await this.jobModel.countDocuments({
        assignedSalesman: user,
        status: {
          $in: [
            JobStatus.ReadyForFitting,
            JobStatus.FitterAssigned,
            JobStatus.FitterOnTheWay,
            JobStatus.FitterReached,
            JobStatus.FitterCancelled,
            JobStatus.Fitting,
            JobStatus.TakingPhotos,
            JobStatus.Completed,
          ],
        },
      }),
      totalPages: Math.ceil(
        (await this.jobModel.countDocuments({
          assignedSalesman: user,
          status: {
            $in: [
              JobStatus.ReadyForFitting,
              JobStatus.FitterAssigned,
              JobStatus.FitterOnTheWay,
              JobStatus.FitterReached,
              JobStatus.FitterCancelled,
              JobStatus.Fitting,
              JobStatus.TakingPhotos,
              JobStatus.Completed,
            ],
          },
        })) / limit,
      ),
    };

    return {
      message: 'Completed jobs fetched successfully',
      data: jobs,
      pagination,
    };
  }
}

interface HomeResponseType {
  message: string;
  data: {
    tommorow: number;
    upcoming: number;
    completed: number;
    cancelled: number;
    todayJobs: JobDocument[];
  };
  pagination: {
    page: number;
    limit: number;
    totalData: number;
    totalPages: number;
  };
}

interface MyJobResponseType {
  message: string;
  data: JobDocument[];
  pagination: {
    page: number;
    limit: number;
    totalData: number;
    totalPages: number;
  };
}
