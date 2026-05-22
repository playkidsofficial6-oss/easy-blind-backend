import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateJobDto } from './dto/create-job.dto';
import { QueryJobsDto } from './dto/query-jobs.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { SalesmanWorkflowDto } from './dto/salesman-workflow.dto';
import {
  Job,
  JobDocument,
  JobStatus,
  SalesmanWorkflowStatus,
} from './schemas/job.schema';
import { geocodeAddress } from './utils/geocoder';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class JobsService implements OnModuleInit {
  constructor(
    @InjectModel(Job.name) private readonly jobModel: Model<JobDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async onModuleInit() {
    this.backfillGeocoding().catch((err) => {
      console.error('Error in job geocoding backfill:', err);
    });
    this.backfillNames().catch((err) => {
      console.error('Error in job names backfill:', err);
    });
  }

  private async backfillNames() {
    const jobsToBackfill = await this.jobModel
      .find({
        $or: [
          { firstName: { $exists: false } },
          { lastName: { $exists: false } },
        ],
      })
      .exec();

    if (jobsToBackfill.length === 0) {
      return;
    }

    console.log(
      `[Backfill] Splitting customerName into firstName and lastName for ${jobsToBackfill.length} jobs...`,
    );
    for (const job of jobsToBackfill) {
      try {
        const anyJob = job as any;
        const customerName = anyJob.customerName || '';
        const parts = customerName.trim().split(' ');
        const firstName = parts[0] || 'Unknown';
        const lastName = parts.slice(1).join(' ') || 'Unknown';

        await this.jobModel
          .updateOne({ _id: job._id }, { $set: { firstName, lastName } })
          .exec();
      } catch (err) {
        console.error(
          `[Backfill] Failed name backfill for job ${job._id}:`,
          err,
        );
      }
    }
    console.log('[Backfill] Name backfill completed.');
  }

  private async backfillGeocoding() {
    const jobsToBackfill = await this.jobModel
      .find({
        address: { $exists: true, $ne: '' },
        $or: [
          { location: { $exists: false } },
          { 'location.coordinates': [0, 0] },
        ],
      })
      .exec();

    if (jobsToBackfill.length === 0) {
      return;
    }

    console.log(
      `[Geocoder] Backfilling location for ${jobsToBackfill.length} jobs...`,
    );
    for (const job of jobsToBackfill) {
      try {
        const coordinates = await geocodeAddress(job.address);
        await this.jobModel
          .findByIdAndUpdate(job._id, {
            location: {
              type: 'Point',
              coordinates,
            },
          })
          .exec();
        // Delay slightly to prevent slamming the geocoding service
        await new Promise((resolve) => setTimeout(resolve, 250));
      } catch (err) {
        console.error(
          `[Geocoder] Failed backfill for job ${job._id}:`,
          err.message,
        );
      }
    }
    console.log('[Geocoder] Location backfill completed.');
  }

  async create(createJobDto: CreateJobDto): Promise<JobDocument> {
    const coordinates = await geocodeAddress(createJobDto.address);
    const createdJob = new this.jobModel({
      ...createJobDto,
      location: {
        type: 'Point',
        coordinates,
      },
      scheduledAt: createJobDto.scheduledAt
        ? new Date(createJobDto.scheduledAt)
        : undefined,
    });
    return createdJob.save();
  }

  async findAll(query: QueryJobsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const filter = this.buildFilter(query);

    const [items, total] = await Promise.all([
      this.jobModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.jobModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findOne(id: string): Promise<JobDocument> {
    const job = await this.jobModel.findById(id).exec();
    if (!job) {
      throw new NotFoundException(`Job with id ${id} was not found`);
    }
    return job;
  }

  async update(id: string, updateJobDto: UpdateJobDto): Promise<JobDocument> {
    let locationUpdate = {};
    if (updateJobDto.address) {
      const coordinates = await geocodeAddress(updateJobDto.address);
      locationUpdate = {
        location: {
          type: 'Point',
          coordinates,
        },
      };
    }

    const dateUpdates: Record<string, Date> = {};
    if (updateJobDto.scheduledAt)
      dateUpdates.scheduledAt = new Date(updateJobDto.scheduledAt);
    if (updateJobDto.timerStartedAt)
      dateUpdates.timerStartedAt = new Date(updateJobDto.timerStartedAt);
    if (updateJobDto.travelStartedAt)
      dateUpdates.travelStartedAt = new Date(updateJobDto.travelStartedAt);
    if (updateJobDto.measurementStartedAt)
      dateUpdates.measurementStartedAt = new Date(
        updateJobDto.measurementStartedAt,
      );
    if (updateJobDto.measurementCompletedAt)
      dateUpdates.measurementCompletedAt = new Date(
        updateJobDto.measurementCompletedAt,
      );

    const updatePayload = {
      ...updateJobDto,
      ...locationUpdate,
      ...dateUpdates,
    };

    const updatedJob = await this.jobModel
      .findByIdAndUpdate(id, updatePayload, { new: true, runValidators: true })
      .exec();

    if (!updatedJob) {
      throw new NotFoundException(`Job with id ${id} was not found`);
    }
    return updatedJob;
  }

  async startSalesmanTravel(
    id: string,
    workflowDto: SalesmanWorkflowDto,
  ): Promise<JobDocument> {
    const now = new Date();
    return this.applySalesmanWorkflow(id, workflowDto, {
      jobStatus: JobStatus.Scheduled,
      workflowStatus: SalesmanWorkflowStatus.Travelling,
      userStatus: 'On the way',
      timestamps: { travelStartedAt: now },
    });
  }

  async startSalesmanMeasuring(
    id: string,
    workflowDto: SalesmanWorkflowDto,
  ): Promise<JobDocument> {
    const now = new Date();
    return this.applySalesmanWorkflow(id, workflowDto, {
      jobStatus: JobStatus.InProgress,
      workflowStatus: SalesmanWorkflowStatus.Measuring,
      userStatus: 'In progress',
      timestamps: { measurementStartedAt: now, timerStartedAt: now },
    });
  }

  async completeSalesmanWorkflow(
    id: string,
    workflowDto: SalesmanWorkflowDto,
  ): Promise<JobDocument> {
    const now = new Date();
    return this.applySalesmanWorkflow(id, workflowDto, {
      jobStatus: JobStatus.Completed,
      workflowStatus: SalesmanWorkflowStatus.Completed,
      userStatus: 'Available',
      timestamps: { measurementCompletedAt: now },
    });
  }

  private async applySalesmanWorkflow(
    id: string,
    workflowDto: SalesmanWorkflowDto,
    state: {
      jobStatus: JobStatus;
      workflowStatus: SalesmanWorkflowStatus;
      userStatus: 'Available' | 'On the way' | 'In progress';
      timestamps: Record<string, Date>;
    },
  ): Promise<JobDocument> {
    const currentJob = await this.jobModel.findById(id).exec();
    if (!currentJob) {
      throw new NotFoundException(`Job with id ${id} was not found`);
    }

    const salesmanId =
      workflowDto.salesmanId ||
      currentJob.activeSalesmanId ||
      currentJob.assignedSalesman ||
      currentJob.assignedTo;
    const salesmanName =
      workflowDto.salesmanName ||
      currentJob.activeSalesmanName ||
      currentJob.assignedTo;

    const updatedJob = await this.jobModel
      .findByIdAndUpdate(
        id,
        {
          status: state.jobStatus,
          salesmanWorkflowStatus: state.workflowStatus,
          activeSalesmanId: salesmanId,
          activeSalesmanName: salesmanName,
          ...(salesmanId ? { assignedSalesman: salesmanId } : {}),
          ...(workflowDto.notes !== undefined
            ? { notes: workflowDto.notes }
            : {}),
          ...state.timestamps,
        },
        { new: true, runValidators: true },
      )
      .exec();

    if (!updatedJob) {
      throw new NotFoundException(`Job with id ${id} was not found`);
    }

    if (salesmanId) {
      await this.userModel
        .findByIdAndUpdate(
          salesmanId,
          { liveStatus: state.userStatus },
          { runValidators: true },
        )
        .exec();
    }

    return updatedJob;
  }

  async remove(id: string) {
    const deletedJob = await this.jobModel.findByIdAndDelete(id).exec();
    if (!deletedJob) {
      throw new NotFoundException(`Job with id ${id} was not found`);
    }

    return {
      deleted: true,
      id,
    };
  }

  private buildFilter(query: QueryJobsDto): Record<string, unknown> {
    const filter: Record<string, unknown> = {};

    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;
    if (query.search) {
      const search = new RegExp(query.search, 'i');
      filter.$or = [
        { firstName: search },
        { lastName: search },
        { customerEmail: search },
        { address: search },
        { productType: search },
      ];
    }

    return filter;
  }
}
