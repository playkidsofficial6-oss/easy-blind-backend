import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateJobDto } from './dto/create-job.dto';
import { QueryJobsDto } from './dto/query-jobs.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { Job, JobDocument } from './schemas/job.schema';

@Injectable()
export class JobsService {
  constructor(
    @InjectModel(Job.name) private readonly jobModel: Model<JobDocument>,
  ) {}

  async create(createJobDto: CreateJobDto): Promise<JobDocument> {
    const createdJob = new this.jobModel({
      ...createJobDto,
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
    const updatedJob = await this.jobModel
      .findByIdAndUpdate(
        id,
        {
          ...updateJobDto,
          scheduledAt: updateJobDto.scheduledAt
            ? new Date(updateJobDto.scheduledAt)
            : undefined,
        },
        { new: true, runValidators: true },
      )
      .exec();

    if (!updatedJob) {
      throw new NotFoundException(`Job with id ${id} was not found`);
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
        { customerName: search },
        { customerEmail: search },
        { address: search },
        { productType: search },
      ];
    }

    return filter;
  }
}
