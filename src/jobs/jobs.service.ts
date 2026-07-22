import {
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { isValidObjectId, Model } from 'mongoose';
import { CreateJobDto } from './dto/create-job.dto';
import { QueryJobsDto } from './dto/query-jobs.dto';
import { SalesmanWorkflowDto } from './dto/salesman-workflow.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JobCounter, JobCounterDocument } from './schemas/job-counter.schema';
import {
  Job,
  JobDocument,
  JobStatus,
  SalesmanWorkflowStatus,
} from './schemas/job.schema';
import { geocodeAddress } from './utils/geocoder';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { LiveLocationGateway } from '../live-location/live-location.gateway';
import { LiveLocationService } from '../live-location/live-location.service';

const JOB_ID_PREFIX = 'JOB';
const JOB_ID_SEQUENCE_WIDTH = 4;
const JOB_ID_PATTERN = /^JOB-\d{4}-\d{4}$/;

@Injectable()
export class JobsService implements OnModuleInit {
  constructor(
    @InjectModel(Job.name) private readonly jobModel: Model<JobDocument>,
    @InjectModel(JobCounter.name)
    private readonly jobCounterModel: Model<JobCounterDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @Inject(forwardRef(() => LiveLocationGateway))
    private readonly liveLocationGateway: LiveLocationGateway,
    @Inject(forwardRef(() => LiveLocationService))
    private readonly liveLocationService: LiveLocationService,
  ) { }

  onModuleInit() {
    this.backfillJobIds().catch((err) => {
      console.error('Error in job ID backfill:', err);
    });
    this.backfillGeocoding().catch((err) => {
      console.error('Error in job geocoding backfill:', err);
    });
    this.backfillNames().catch((err) => {
      console.error('Error in job names backfill:', err);
    });
    this.backfillUserReferences().catch((err) => {
      console.error('Error in user reference backfill:', err);
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

  private parseJobId(
    jobId?: string | null,
  ): { year: string; sequence: number } | null {
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
        {
          $inc: { sequence: 1 },
          $setOnInsert: { key: this.getCounterKey(year) },
        },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
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

    console.log(
      `[Backfill] Assigning Job IDs for ${jobsToBackfill.length} jobs...`,
    );
    for (const job of jobsToBackfill) {
      try {
        const { createdAt } = job as JobDocument & {
          createdAt?: Date | string;
        };
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
        console.error(
          `[Backfill] Failed Job ID backfill for job ${String(job._id)}:`,
          err,
        );
      }
    }
    console.log('[Backfill] Job ID backfill completed.');
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
        const anyJob = job as unknown as { customerName?: string };
        const customerName = anyJob.customerName || '';
        const parts = customerName.trim().split(' ');
        const firstName = parts[0] || 'Unknown';
        const lastName = parts.slice(1).join(' ') || 'Unknown';

        await this.jobModel
          .updateOne({ _id: job._id }, { $set: { firstName, lastName } })
          .exec();
      } catch (err) {
        console.error(
          `[Backfill] Failed name backfill for job ${String(job._id)}:`,
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
        await new Promise((resolve) => setTimeout(resolve, 250));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          `[Geocoder] Failed backfill for job ${String(job._id)}:`,
          message,
        );
      }
    }
    console.log('[Geocoder] Location backfill completed.');
  }

  private async resolveUserObjectId(
    input?: string | mongoose.Types.ObjectId | any,
  ): Promise<mongoose.Types.ObjectId | undefined> {
    if (!input) return undefined;

    if (input instanceof mongoose.Types.ObjectId) {
      return input;
    }

    if (typeof input === 'object' && input._id) {
      if (input._id instanceof mongoose.Types.ObjectId) {
        return input._id;
      }
      if (typeof input._id === 'string' && isValidObjectId(input._id)) {
        return new mongoose.Types.ObjectId(input._id);
      }
    }

    const inputStr = String(input).trim();
    if (!inputStr) return undefined;

    if (isValidObjectId(inputStr)) {
      const userById = await this.userModel.findById(inputStr).exec();
      if (userById) {
        return userById._id as mongoose.Types.ObjectId;
      }
      return new mongoose.Types.ObjectId(inputStr);
    }

    const normalizedRole = inputStr.toLowerCase().replace(/\s+/g, '_');
    const queryFilter: Record<string, any> = {
      $or: [
        { name: { $regex: new RegExp(`^${inputStr}$`, 'i') } },
        { email: inputStr.toLowerCase() },
        { role: inputStr },
        { role: normalizedRole },
      ],
    };
    const userByNameOrRole = await this.userModel.findOne(queryFilter).exec();

    if (userByNameOrRole) {
      return userByNameOrRole._id as mongoose.Types.ObjectId;
    }

    if (
      normalizedRole.includes('sales_manager') ||
      normalizedRole.includes('sales')
    ) {
      const fallbackUser = await this.userModel
        .findOne({ role: { $in: [UserRole.SalesManager, UserRole.Admin] } })
        .exec();
      if (fallbackUser) return fallbackUser._id as mongoose.Types.ObjectId;
    }

    return undefined;
  }

  private async backfillUserReferences() {
    const jobs = await this.jobModel.find().exec();
    if (jobs.length === 0) return;

    let updatedCount = 0;
    for (const job of jobs) {
      try {
        const anyJob = job.toObject() as Record<string, any>;
        const updates: Record<string, any> = {};

        if (
          anyJob.assignedTo &&
          (typeof anyJob.assignedTo === 'string' ||
            !(anyJob.assignedTo instanceof mongoose.Types.ObjectId))
        ) {
          const resolved = await this.resolveUserObjectId(anyJob.assignedTo);
          if (resolved) updates.assignedTo = resolved;
        }

        if (
          anyJob.assignedSalesman &&
          (typeof anyJob.assignedSalesman === 'string' ||
            !(anyJob.assignedSalesman instanceof mongoose.Types.ObjectId))
        ) {
          const resolved = await this.resolveUserObjectId(
            anyJob.assignedSalesman,
          );
          if (resolved) updates.assignedSalesman = resolved;
        }

        if (
          anyJob.assignedBy &&
          (typeof anyJob.assignedBy === 'string' ||
            !(anyJob.assignedBy instanceof mongoose.Types.ObjectId))
        ) {
          const resolved = await this.resolveUserObjectId(anyJob.assignedBy);
          if (resolved) updates.assignedBy = resolved;
        }

        if (
          anyJob.assignedFitter &&
          (typeof anyJob.assignedFitter === 'string' ||
            !(anyJob.assignedFitter instanceof mongoose.Types.ObjectId))
        ) {
          const resolved = await this.resolveUserObjectId(
            anyJob.assignedFitter,
          );
          if (resolved) updates.assignedFitter = resolved;
        }

        if (
          (updates.assignedSalesman || anyJob.assignedSalesman) &&
          !anyJob.assignedTo &&
          !updates.assignedTo
        ) {
          updates.assignedTo =
            updates.assignedSalesman || anyJob.assignedSalesman;
        } else if (
          (updates.assignedTo || anyJob.assignedTo) &&
          !anyJob.assignedSalesman &&
          !updates.assignedSalesman
        ) {
          updates.assignedSalesman = updates.assignedTo || anyJob.assignedTo;
        }

        if (Object.keys(updates).length > 0) {
          await this.jobModel
            .updateOne({ _id: job._id }, { $set: updates })
            .exec();
          updatedCount++;
        }
      } catch (err) {
        console.error(
          `[Backfill] Failed user reference backfill for job ${String(job._id)}:`,
          err,
        );
      }
    }
    if (updatedCount > 0) {
      console.log(
        `[Backfill] Converted user references to BSON ObjectIds for ${updatedCount} jobs.`,
      );
    }
  }

  private async findUserByAssignment(
    assignedTo?: string | mongoose.Types.ObjectId | any,
  ): Promise<UserDocument | null> {
    if (!assignedTo) return null;
    let assignedToStr = '';
    if (typeof assignedTo === 'object' && assignedTo._id) {
      assignedToStr = assignedTo._id.toString();
    } else {
      assignedToStr = assignedTo.toString();
    }
    return this.userModel
      .findOne({
        $or: [
          ...(isValidObjectId(assignedToStr) ? [{ _id: assignedToStr }] : []),
          { name: assignedToStr },
          { email: assignedToStr },
        ],
      })
      .exec();
  }

  private async notifySalesmanJobAssignment(
    job: JobDocument,
    oldSalesmanUserId?: string,
  ) {
    try {
      const assignedTo = job.assignedSalesman || job.assignedTo;
      if (assignedTo) {
        const user = await this.findUserByAssignment(assignedTo);
        if (user) {
          this.liveLocationGateway.server
            .to(`user:${String(user._id)}`)
            .emit('job:assigned', job.toJSON());
          console.log(
            `[Socket] Emitted job:assigned to user:${String(user._id)} for job ${job.jobId}`,
          );
        }
      }

      if (oldSalesmanUserId) {
        const currentSalesmanUser = assignedTo
          ? await this.findUserByAssignment(assignedTo)
          : null;
        if (
          !currentSalesmanUser ||
          currentSalesmanUser._id.toString() !== oldSalesmanUserId
        ) {
          const unassignedJobCopy: Record<string, any> = job.toJSON();
          unassignedJobCopy.assignedTo = '';
          unassignedJobCopy.assignedSalesman = '';
          this.liveLocationGateway.server
            .to(`user:${oldSalesmanUserId}`)
            .emit('job:assigned', unassignedJobCopy);
          console.log(
            `[Socket] Emitted job:assigned unassignment to user:${oldSalesmanUserId} for job ${job.jobId}`,
          );
        }
      }
    } catch (err) {
      console.error(
        '[Socket] Failed to emit job assignment notification:',
        err,
      );
    }
  }

  async create(createJobDto: CreateJobDto): Promise<JobDocument> {
    const coordinates =
      createJobDto.location?.coordinates ||
      (await geocodeAddress(createJobDto.address));
    const jobId = await this.generateNextJobId();

    const assignedTo = await this.resolveUserObjectId(createJobDto.assignedTo);
    const assignedSalesman =
      (await this.resolveUserObjectId(createJobDto.assignedSalesman)) ||
      assignedTo;
    const assignedBy = await this.resolveUserObjectId(createJobDto.assignedBy);
    const assignedFitter = await this.resolveUserObjectId(
      createJobDto.assignedFitter,
    );
    const finalAssignedTo = assignedTo || assignedSalesman;

    const rawJobData = { ...createJobDto } as Record<string, any>;
    delete rawJobData.assignedTo;
    delete rawJobData.assignedSalesman;
    delete rawJobData.assignedBy;
    delete rawJobData.assignedFitter;

    const createdJob = new this.jobModel({
      ...rawJobData,
      jobId,
      ...(finalAssignedTo ? { assignedTo: finalAssignedTo } : {}),
      ...(assignedSalesman ? { assignedSalesman } : {}),
      ...(assignedBy ? { assignedBy } : {}),
      ...(assignedFitter ? { assignedFitter } : {}),
      location: {
        type: 'Point',
        coordinates,
      },
      scheduledAt: createJobDto.scheduledAt
        ? new Date(createJobDto.scheduledAt)
        : undefined,
    });
    const savedJob = await createdJob.save();
    this.notifySalesmanJobAssignment(savedJob).catch((err) => {
      console.error(
        '[Socket] Failed to run notifySalesmanJobAssignment async:',
        err,
      );
    });
    return (await this.findOne(savedJob._id.toString())) as JobDocument;
  }

  async findAll(query: QueryJobsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const filter = this.buildFilter(query);

    const [items, total] = await Promise.all([
      this.jobModel
        .find(filter)
        .populate('assignedTo', 'name email role phone liveStatus')
        .populate('assignedSalesman', 'name email role phone liveStatus')
        .populate('assignedBy', 'name email role phone liveStatus')
        .populate('assignedFitter', 'name email role phone liveStatus')
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
    const job = await this.findByMongoIdOrJobId(id);
    if (!job) {
      throw new NotFoundException(`Job with id ${id} was not found`);
    }
    return job;
  }

  async update(id: string, updateJobDto: UpdateJobDto): Promise<JobDocument> {
    const currentJob = await this.findByMongoIdOrJobId(id);
    let oldSalesmanUserId: string | undefined;
    if (currentJob) {
      const assignedTo = currentJob.assignedSalesman || currentJob.assignedTo;
      if (assignedTo) {
        const oldUser = await this.findUserByAssignment(assignedTo);
        if (oldUser) {
          oldSalesmanUserId = oldUser._id.toString();
        }
      }
    }

    const safeUpdateDto = { ...updateJobDto } as UpdateJobDto & {
      jobId?: string;
    };
    delete safeUpdateDto.jobId;
    delete (safeUpdateDto as any).assignedTo;
    delete (safeUpdateDto as any).assignedSalesman;
    delete (safeUpdateDto as any).assignedBy;
    delete (safeUpdateDto as any).assignedFitter;

    const resolvedUserFields: Record<string, any> = {};
    if (updateJobDto.assignedTo !== undefined) {
      const resolved = await this.resolveUserObjectId(updateJobDto.assignedTo);
      if (resolved) resolvedUserFields.assignedTo = resolved;
    }
    if (updateJobDto.assignedSalesman !== undefined) {
      const resolved = await this.resolveUserObjectId(
        updateJobDto.assignedSalesman,
      );
      if (resolved) resolvedUserFields.assignedSalesman = resolved;
    }
    if (updateJobDto.assignedBy !== undefined) {
      const resolved = await this.resolveUserObjectId(updateJobDto.assignedBy);
      if (resolved) resolvedUserFields.assignedBy = resolved;
    }
    if (updateJobDto.assignedFitter !== undefined) {
      const resolved = await this.resolveUserObjectId(
        updateJobDto.assignedFitter,
      );
      if (resolved) resolvedUserFields.assignedFitter = resolved;
    }

    if (
      resolvedUserFields.assignedSalesman &&
      !resolvedUserFields.assignedTo
    ) {
      resolvedUserFields.assignedTo = resolvedUserFields.assignedSalesman;
    } else if (
      resolvedUserFields.assignedTo &&
      !resolvedUserFields.assignedSalesman
    ) {
      resolvedUserFields.assignedSalesman = resolvedUserFields.assignedTo;
    }

    let locationUpdate = {};
    if (safeUpdateDto.address && !safeUpdateDto.location) {
      const coordinates = await geocodeAddress(safeUpdateDto.address);
      locationUpdate = {
        location: {
          type: 'Point',
          coordinates,
        },
      };
    }

    const dateUpdates: Record<string, Date> = {};
    if (safeUpdateDto.scheduledAt)
      dateUpdates.scheduledAt = new Date(safeUpdateDto.scheduledAt);
    if (safeUpdateDto.timerStartedAt)
      dateUpdates.timerStartedAt = new Date(safeUpdateDto.timerStartedAt);
    if (safeUpdateDto.travelStartedAt)
      dateUpdates.travelStartedAt = new Date(safeUpdateDto.travelStartedAt);
    if (safeUpdateDto.measurementStartedAt)
      dateUpdates.measurementStartedAt = new Date(
        safeUpdateDto.measurementStartedAt,
      );
    if (safeUpdateDto.measurementCompletedAt)
      dateUpdates.measurementCompletedAt = new Date(
        safeUpdateDto.measurementCompletedAt,
      );

    const updatePayload = {
      ...safeUpdateDto,
      ...resolvedUserFields,
      ...locationUpdate,
      ...dateUpdates,
    };

    const updatedJob = await this.jobModel
      .findOneAndUpdate(this.getIdentifierFilter(id), updatePayload, {
        returnDocument: 'after',
        runValidators: true,
      })
      .exec();

    if (!updatedJob) {
      throw new NotFoundException(`Job with id ${id} was not found`);
    }

    this.notifySalesmanJobAssignment(updatedJob, oldSalesmanUserId).catch(
      (err) => {
        console.error(
          '[Socket] Failed to run notifySalesmanJobAssignment async on update:',
          err,
        );
      },
    );

    return (await this.findOne(updatedJob._id.toString())) as JobDocument;
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
    const currentJob = await this.findByMongoIdOrJobId(id);
    if (!currentJob) {
      throw new NotFoundException(`Job with id ${id} was not found`);
    }

    const salesmanId = (
      workflowDto.salesmanId ||
      currentJob.activeSalesmanId ||
      currentJob.assignedSalesman ||
      currentJob.assignedTo
    )?.toString();
    const salesmanName = (
      workflowDto.salesmanName ||
      currentJob.activeSalesmanName ||
      currentJob.assignedTo
    )?.toString();

    const updatedJob = await this.jobModel
      .findOneAndUpdate(
        this.getIdentifierFilter(id),
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
        { returnDocument: 'after', runValidators: true },
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

      await this.liveLocationService.updateLiveStatus(
        salesmanId,
        state.userStatus,
      );

      console.log(
        `🚗 Emitting salesman:status-changed`,
        `userId: ${salesmanId}`,
        `status: ${state.userStatus}`,
      );

      try {
        this.liveLocationGateway.server
          .to('live-location:managers')
          .emit('salesman:status-changed', {
            userId: salesmanId,
            status: state.userStatus,
            role: 'Salesman',
            jobId: id,
          });
        console.log(
          `[Socket] Emitted salesman:status-changed to managers for ${salesmanId} -> ${state.userStatus}`,
        );
      } catch (err) {
        console.error('[Socket] Failed to emit salesman:status-changed:', err);
      }
    }

    return updatedJob;
  }

  async remove(id: string) {
    const deletedJob = await this.jobModel
      .findOneAndDelete(this.getIdentifierFilter(id))
      .exec();
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
    return this.jobModel
      .findOne(this.getIdentifierFilter(id))
      .populate('assignedTo', 'name email role phone liveStatus')
      .populate('assignedSalesman', 'name email role phone liveStatus')
      .populate('assignedBy', 'name email role phone liveStatus')
      .populate('assignedFitter', 'name email role phone liveStatus')
      .exec();
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
