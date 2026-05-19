import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateJobDto } from './dto/create-job.dto';
import { QueryJobsDto } from './dto/query-jobs.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { Job, JobDocument } from './schemas/job.schema';
import { geocodeAddress } from './utils/geocoder';

@Injectable()
export class JobsService implements OnModuleInit {
  constructor(
    @InjectModel(Job.name) private readonly jobModel: Model<JobDocument>,
  ) {}

  async onModuleInit() {
    this.backfillGeocoding().catch((err) => {
      console.error('Error in job geocoding backfill:', err);
    });
  }

  private async backfillGeocoding() {
    const jobsToBackfill = await this.jobModel.find({
      address: { $exists: true, $ne: '' },
      $or: [
        { location: { $exists: false } },
        { 'location.coordinates': [0, 0] },
      ],
    }).exec();

    if (jobsToBackfill.length === 0) {
      return;
    }

    console.log(`[Geocoder] Backfilling location for ${jobsToBackfill.length} jobs...`);
    for (const job of jobsToBackfill) {
      try {
        const coordinates = await geocodeAddress(job.address);
        await this.jobModel.findByIdAndUpdate(job._id, {
          location: {
            type: 'Point',
            coordinates,
          },
        }).exec();
        // Delay slightly to prevent slamming the geocoding service
        await new Promise((resolve) => setTimeout(resolve, 250));
      } catch (err) {
        console.error(`[Geocoder] Failed backfill for job ${job._id}:`, err.message);
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

    const updatedJob = await this.jobModel
      .findByIdAndUpdate(
        id,
        {
          ...updateJobDto,
          ...locationUpdate,
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
