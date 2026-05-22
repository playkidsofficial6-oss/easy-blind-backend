import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { CreateJobDto } from './dto/create-job.dto';
import { QueryJobsDto } from './dto/query-jobs.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JobCounter, JobCounterDocument } from './schemas/job-counter.schema';
import { Job, JobDocument } from './schemas/job.schema';
import { geocodeAddress } from './utils/geocoder';

const JOB_ID_PREFIX = 'JOB';
const JOB_ID_SEQUENCE_WIDTH = 4;
const JOB_ID_PATTERN = /^JOB-\d{4}-\d{4}$/;

@Injectable()
export class JobsService implements OnModuleInit {
  constructor(
    @InjectModel(Job.name) private readonly jobModel: Model<JobDocument>,
    @InjectModel(JobCounter.name)
    private readonly jobCounterModel: Model<JobCounterDocument>,
  ) {}

  async onModuleInit() {
    this.backfillJobIds().catch((err) => {
      console.error('Error in job ID backfill:', err);
    });
    this.backfillGeocoding().catch((err) => {
      console.error('Error in job geocoding backfill:', err);
    });
    this.backfillNames().catch((err) => {
      console.error('Error in job names backfill:', err);
    });
  }

  private getYear(date = new Date()): string {
    return String(date.getFullYear());
  }

  private getCounterKey(year = this.getYear()): string {
    return `job:${year}`;
  }

  private formatJobId(sequence: number, year = this.getYear()): string {
    return `${JOB_ID_PREFIX}-${year}-${String(sequence).padStart(
      JOB_ID_SEQUENCE_WIDTH,
      '0',
    )}`;
  }

  private parseJobId(jobId?: string | null): { year: string; sequence: number } | null {
    if (!jobId || !JOB_ID_PATTERN.test(jobId)) {
      return null;
    }

    const [, year, sequence] = jobId.split('-');

    return {
      year,
      sequence: Number(sequence),
    };
  }

  private async ensureCounterAtLeast(year: string, sequence: number) {
    await this.jobCounterModel
      .findOneAndUpdate(
        { key: this.getCounterKey(year), sequence: { $lt: sequence } },
        { $set: { sequence } },
        { upsert: false },
      )
      .exec();

    await this.jobCounterModel
      .updateOne(
        { key: this.getCounterKey(year) },
        { $setOnInsert: { key: this.getCounterKey(year), sequence } },
        { upsert: true },
      )
      .exec();
  }

  private async generateNextJobId(date = new Date()): Promise<string> {
    const year = this.getYear(date);
    const counter = await this.jobCounterModel
      .findOneAndUpdate(
        { key: this.getCounterKey(year) },
        { $inc: { sequence: 1 }, $setOnInsert: { key: this.getCounterKey(year) } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();

    return this.formatJobId(counter.sequence, year);
  }

  private async backfillJobIds() {
    const jobsWithValidIds = await this.jobModel
      .find({ jobId: { $regex: JOB_ID_PATTERN } })
      .select('jobId')
      .lean()
      .exec();

    const maxSequenceByYear = new Map<string, number>();
    for (const job of jobsWithValidIds) {
      const parsed = this.parseJobId(job.jobId);
      if (!parsed) continue;
      maxSequenceByYear.set(
        parsed.year,
        Math.max(maxSequenceByYear.get(parsed.year) ?? 0, parsed.sequence),
      );
    }

    for (const [year, sequence] of maxSequenceByYear) {
      await this.ensureCounterAtLeast(year, sequence);
    }

    const jobsToBackfill = await this.jobModel
      .find({
        $or: [
          { jobId: { $exists: false } },
          { jobId: null },
          { jobId: '' },
          { jobId: { $not: JOB_ID_PATTERN } },
        ],
      })
      .sort({ createdAt: 1, _id: 1 })
      .exec();

    if (jobsToBackfill.length === 0) {
      return;
    }

    console.log(`[Backfill] Assigning Job IDs for ${jobsToBackfill.length} jobs...`);
    for (const job of jobsToBackfill) {
      try {
        const { createdAt } = job as JobDocument & { createdAt?: Date | string };
        const dateSeed = createdAt ? new Date(createdAt) : new Date();
        const jobId = await this.generateNextJobId(dateSeed);
        await this.jobModel
          .updateOne(
            {
              _id: job._id,
              $or: [
                { jobId: { $exists: false } },
                { jobId: null },
                { jobId: '' },
                { jobId: { $not: JOB_ID_PATTERN } },
              ],
            },
            { $set: { jobId } },
            { runValidators: true },
          )
          .exec();
      } catch (err) {
        console.error(`[Backfill] Failed Job ID backfill for job ${job._id}:`, err);
      }
    }
    console.log('[Backfill] Job ID backfill completed.');
  }

  private async backfillNames() {
    const jobsToBackfill = await this.jobModel
      .find({
        $or: [{ firstName: { $exists: false } }, { lastName: { $exists: false } }],
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
        const anyJob = job as unknown as { customerName?: string };
        const customerName = anyJob.customerName || '';
        const parts = customerName.trim().split(' ');
        const firstName = parts[0] || 'Unknown';
        const lastName = parts.slice(1).join(' ') || 'Unknown';

        await this.jobModel.updateOne({ _id: job._id }, { $set: { firstName, lastName } }).exec();
      } catch (err) {
        console.error(`[Backfill] Failed name backfill for job ${job._id}:`, err);
      }
    }
    console.log('[Backfill] Name backfill completed.');
  }

  private async backfillGeocoding() {
    const jobsToBackfill = await this.jobModel
      .find({
        address: { $exists: true, $ne: '' },
        $or: [{ location: { $exists: false } }, { 'location.coordinates': [0, 0] }],
      })
      .exec();

    if (jobsToBackfill.length === 0) {
      return;
    }

    console.log(`[Geocoder] Backfilling location for ${jobsToBackfill.length} jobs...`);
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
        await new Promise((resolve) => setTimeout(resolve, 250));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Geocoder] Failed backfill for job ${job._id}:`, message);
      }
    }
    console.log('[Geocoder] Location backfill completed.');
  }

  async create(createJobDto: CreateJobDto): Promise<JobDocument> {
    const coordinates = await geocodeAddress(createJobDto.address);
    const jobId = await this.generateNextJobId();
    const createdJob = new this.jobModel({
      ...createJobDto,
      jobId,
      location: {
        type: 'Point',
        coordinates,
      },
      scheduledAt: createJobDto.scheduledAt ? new Date(createJobDto.scheduledAt) : undefined,
    });
    return createdJob.save();
  }

  async findAll(query: QueryJobsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const filter = this.buildFilter(query);

    const [items, total] = await Promise.all([
      this.jobModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
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
    const job = await this.findByMongoIdOrJobId(id);
    if (!job) {
      throw new NotFoundException(`Job with id ${id} was not found`);
    }
    return job;
  }

  async update(id: string, updateJobDto: UpdateJobDto): Promise<JobDocument> {
    const { jobId: _jobId, ...safeUpdateDto } = updateJobDto as UpdateJobDto & { jobId?: string };
    let locationUpdate = {};
    if (safeUpdateDto.address) {
      const coordinates = await geocodeAddress(safeUpdateDto.address);
      locationUpdate = {
        location: {
          type: 'Point',
          coordinates,
        },
      };
    }

    const updatedJob = await this.jobModel
      .findOneAndUpdate(
        this.getIdentifierFilter(id),
        {
          ...safeUpdateDto,
          ...locationUpdate,
          scheduledAt: safeUpdateDto.scheduledAt ? new Date(safeUpdateDto.scheduledAt) : undefined,
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
    const deletedJob = await this.jobModel.findOneAndDelete(this.getIdentifierFilter(id)).exec();
    if (!deletedJob) {
      throw new NotFoundException(`Job with id ${id} was not found`);
    }

    return {
      deleted: true,
      id,
      jobId: deletedJob.jobId,
    };
  }

  private async findByMongoIdOrJobId(id: string): Promise<JobDocument | null> {
    return this.jobModel.findOne(this.getIdentifierFilter(id)).exec();
  }

  private getIdentifierFilter(id: string): Record<string, unknown> {
    if (JOB_ID_PATTERN.test(id)) {
      return { jobId: id.toUpperCase() };
    }

    if (isValidObjectId(id)) {
      return { _id: id };
    }

    return { jobId: id.toUpperCase() };
  }

  private buildFilter(query: QueryJobsDto): Record<string, unknown> {
    const filter: Record<string, unknown> = {};

    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;
    if (query.search) {
      const searchText = query.search.trim();
      const search = new RegExp(searchText, 'i');
      filter.$or = [
        { jobId: search },
        { firstName: search },
        { lastName: search },
        { customerEmail: search },
        { customerPhone: search },
        { address: search },
        { productType: search },
      ];
    }

    return filter;
  }
}
