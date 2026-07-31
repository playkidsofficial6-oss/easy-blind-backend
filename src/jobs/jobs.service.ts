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
import { AssignFitterDto } from './dto/assign-fitter.dto';
import { FitterWorkflowDto } from './dto/fitter-workflow.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import {
  Job,
  JobDocument,
  JobStatus,
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

  private async generateNextJobId(date = new Date()): Promise<string> {
    const year = this.getYear(date);
    const yearPattern = new RegExp(`^JOB-${year}-\\d{4}$`);

    const latestJob = await this.jobModel
      .findOne({ jobId: { $regex: yearPattern } })
      .sort({ jobId: -1 })
      .select('jobId')
      .exec();

    let nextSequence = 1;
    if (latestJob?.jobId) {
      const parsed = this.parseJobId(latestJob.jobId);
      if (parsed) {
        nextSequence = parsed.sequence + 1;
      }
    }

    return this.formatJobId(nextSequence, year);
  }

  private async backfillJobIds() {
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

    const queryFilter: Record<string, any> = {
      $or: [
        { name: { $regex: new RegExp(`^${inputStr}$`, 'i') } },
        { email: inputStr.toLowerCase() },
        { role: inputStr },
      ],
    };
    const userByNameOrRole = await this.userModel.findOne(queryFilter).exec();

    if (userByNameOrRole) {
      return userByNameOrRole._id as mongoose.Types.ObjectId;
    }

    if (inputStr === UserRole.SalesManager || inputStr === UserRole.Salesman) {
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

        if (anyJob.assignedBy && !anyJob.assignedSalesManager) {
          const resolved = await this.resolveUserObjectId(anyJob.assignedBy);
          if (resolved) updates.assignedSalesManager = resolved;
          updates.$unset = { ...(updates.$unset || {}), assignedBy: 1 };
        } else if (
          anyJob.assignedSalesManager &&
          (typeof anyJob.assignedSalesManager === 'string' ||
            !(anyJob.assignedSalesManager instanceof mongoose.Types.ObjectId))
        ) {
          const resolved = await this.resolveUserObjectId(
            anyJob.assignedSalesManager,
          );
          if (resolved) updates.assignedSalesManager = resolved;
        } else if (!anyJob.assignedSalesManager) {
          const resolved = await this.resolveUserObjectId(UserRole.SalesManager);
          if (resolved) updates.assignedSalesManager = resolved;
        }

        if (
          anyJob.fittingPhotos &&
          anyJob.fittingPhotos.length > 0 &&
          (!anyJob.photos || anyJob.photos.length === 0)
        ) {
          updates.photos = anyJob.fittingPhotos;
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
          anyJob.assignedFitter &&
          (typeof anyJob.assignedFitter === 'string' ||
            !(anyJob.assignedFitter instanceof mongoose.Types.ObjectId))
        ) {
          const resolved = await this.resolveUserObjectId(
            anyJob.assignedFitter,
          );
          if (resolved) updates.assignedFitter = resolved;
        }

        if (anyJob.assignedTo !== undefined) {
          if (!updates.assignedSalesman && !anyJob.assignedSalesman) {
            const resolved = await this.resolveUserObjectId(anyJob.assignedTo);
            if (resolved) updates.assignedSalesman = resolved;
          }
          updates.$unset = { ...(updates.$unset || {}), assignedTo: 1 };
        }

        if (Object.keys(updates).length > 0) {
          await this.jobModel.updateOne({ _id: job._id }, updates).exec();
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
    assignedTarget?: string | mongoose.Types.ObjectId | any,
  ): Promise<UserDocument | null> {
    if (!assignedTarget) return null;
    let targetStr = '';
    if (typeof assignedTarget === 'object' && assignedTarget._id) {
      targetStr = assignedTarget._id.toString();
    } else {
      targetStr = assignedTarget.toString();
    }
    return this.userModel
      .findOne({
        $or: [
          ...(isValidObjectId(targetStr) ? [{ _id: targetStr }] : []),
          { name: targetStr },
          { email: targetStr },
        ],
      })
      .exec();
  }

  private async notifySalesmanJobAssignment(
    job: JobDocument,
    oldSalesmanUserId?: string,
  ) {
    try {
      const assignedSalesman = job.assignedSalesman;
      if (assignedSalesman) {
        const user = await this.findUserByAssignment(assignedSalesman);
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
        const currentSalesmanUser = assignedSalesman
          ? await this.findUserByAssignment(assignedSalesman)
          : null;
        if (
          !currentSalesmanUser ||
          currentSalesmanUser._id.toString() !== oldSalesmanUserId
        ) {
          const unassignedJobCopy: Record<string, any> = job.toJSON();
          unassignedJobCopy.assignedSalesman = null;
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

  async create(
    createJobDto: CreateJobDto,
    currentUser?: any,
  ): Promise<JobDocument> {
    const coordinates =
      createJobDto.location?.coordinates ||
      (await geocodeAddress(createJobDto.address));
    const jobId = await this.generateNextJobId();

    let assignedSalesManager = await this.resolveUserObjectId(
      createJobDto.assignedSalesManager,
    );

    if (!assignedSalesManager && currentUser?.userId) {
      const user = await this.userModel.findById(currentUser.userId).exec();
      if (user) {
        if (
          user.role === UserRole.SalesManager ||
          user.role === UserRole.Admin ||
          user.role === UserRole.Owner
        ) {
          assignedSalesManager = user._id as mongoose.Types.ObjectId;
        }
      }
    }

    if (!assignedSalesManager) {
      assignedSalesManager = await this.resolveUserObjectId(
        UserRole.SalesManager,
      );
    }
    const assignedSalesman = await this.resolveUserObjectId(
      createJobDto.assignedSalesman,
    );
    const assignedFitter = await this.resolveUserObjectId(
      createJobDto.assignedFitter,
    );

    const rawJobData = { ...createJobDto } as Record<string, any>;
    delete rawJobData.assignedSalesManager;
    delete rawJobData.assignedSalesman;
    delete rawJobData.assignedFitter;

    const createdJob = new this.jobModel({
      ...rawJobData,
      jobId,
      ...(assignedSalesManager ? { assignedSalesManager } : {}),
      ...(assignedSalesman ? { assignedSalesman } : {}),
      ...(assignedFitter ? { assignedFitter } : {}),
      location: {
        type: 'Point',
        coordinates,
      },
      scheduledAt: createJobDto.scheduledAt
        ? new Date(createJobDto.scheduledAt)
        : undefined,
    });

    if (assignedFitter) {
      createdJob.status = JobStatus.FitterAssigned;
    } else if (assignedSalesman) {
      createdJob.status = JobStatus.SalesmanScheduled;
    }

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
        .populate(
          'assignedSalesManager',
          'name email role phone checkedIn',
        )
        .populate(
          'assignedSalesman',
          'name email role phone checkedIn',
        )
        .populate('assignedFitter', 'name email role phone checkedIn')
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
    if (currentJob && currentJob.assignedSalesman) {
      const oldUser = await this.findUserByAssignment(
        currentJob.assignedSalesman,
      );
      if (oldUser) {
        oldSalesmanUserId = oldUser._id.toString();
      }
    }

    const safeUpdateDto = { ...updateJobDto } as UpdateJobDto & {
      jobId?: string;
    };
    delete safeUpdateDto.jobId;
    delete (safeUpdateDto as any).assignedSalesManager;
    delete (safeUpdateDto as any).assignedSalesman;
    delete (safeUpdateDto as any).assignedFitter;

    const resolvedUserFields: Record<string, any> = {};
    if (updateJobDto.assignedSalesManager !== undefined) {
      const resolved = await this.resolveUserObjectId(
        updateJobDto.assignedSalesManager,
      );
      resolvedUserFields.assignedSalesManager = resolved || null;
    }
    if (updateJobDto.assignedSalesman !== undefined) {
      const resolved = await this.resolveUserObjectId(
        updateJobDto.assignedSalesman,
      );
      resolvedUserFields.assignedSalesman = resolved || null;
    }
    if (updateJobDto.assignedFitter !== undefined) {
      const resolved = await this.resolveUserObjectId(
        updateJobDto.assignedFitter,
      );
      resolvedUserFields.assignedFitter = resolved || null;
    }

    if (resolvedUserFields.assignedFitter) {
      resolvedUserFields.status = JobStatus.FitterAssigned;
    } else if (resolvedUserFields.assignedSalesman) {
      resolvedUserFields.status = JobStatus.SalesmanScheduled;
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
    return this.applySalesmanWorkflow(id, workflowDto, {
      jobStatus: JobStatus.SalesmanOnTheWay,
      timestamps: {},
    });
  }

  async startSalesmanMeasuring(
    id: string,
    workflowDto: SalesmanWorkflowDto,
  ): Promise<JobDocument> {
    return this.applySalesmanWorkflow(id, workflowDto, {
      jobStatus: JobStatus.Measuring,
      timestamps: {},
    });
  }

  async completeSalesmanWorkflow(
    id: string,
    workflowDto: SalesmanWorkflowDto,
  ): Promise<JobDocument> {
    const now = new Date();
    return this.applySalesmanWorkflow(id, workflowDto, {
      jobStatus: JobStatus.Quoting,
      timestamps: { measurementCompletedAt: now },
    });
  }

  async assignFitter(
    id: string,
    dto: AssignFitterDto,
  ): Promise<JobDocument> {
    const job = await this.findByMongoIdOrJobId(id);
    if (!job) {
      throw new NotFoundException(`Job with id ${id} was not found`);
    }

    const fitterUser = await this.userModel.findOne({
      _id: dto.fitterId,
      role: UserRole.Fitter,
    });

    if (!fitterUser) {
      throw new NotFoundException(`Fitter with id ${dto.fitterId} was not found`);
    }

    await this.jobModel
      .findOneAndUpdate(
        this.getIdentifierFilter(id),
        {
          $set: {
            assignedFitter: fitterUser._id,
            status: JobStatus.FitterAssigned,
          },
        },
        { runValidators: true },
      )
      .exec();

    return (await this.findByMongoIdOrJobId(id)) as JobDocument;
  }

  async startFitterTravel(
    id: string,
    dto: FitterWorkflowDto,
  ): Promise<JobDocument> {
    const job = await this.findByMongoIdOrJobId(id);
    if (!job) {
      throw new NotFoundException(`Job with id ${id} was not found`);
    }

    const updateObj: Record<string, any> = {
      status: JobStatus.FitterOnTheWay,
      fitterTravelStartedAt: new Date(),
    };
    if (dto.notes) {
      updateObj.notes = job.notes ? `${job.notes}\n${dto.notes}` : dto.notes;
    }

    await this.jobModel
      .findOneAndUpdate(
        this.getIdentifierFilter(id),
        { $set: updateObj },
        { runValidators: true },
      )
      .exec();

    return (await this.findByMongoIdOrJobId(id)) as JobDocument;
  }

  async startFitterFitting(
    id: string,
    dto: FitterWorkflowDto,
  ): Promise<JobDocument> {
    const job = await this.findByMongoIdOrJobId(id);
    if (!job) {
      throw new NotFoundException(`Job with id ${id} was not found`);
    }

    const updateObj: Record<string, any> = {
      status: JobStatus.Fitting,
      fittingStartedAt: new Date(),
    };
    if (dto.notes) {
      updateObj.notes = job.notes ? `${job.notes}\n${dto.notes}` : dto.notes;
    }

    await this.jobModel
      .findOneAndUpdate(
        this.getIdentifierFilter(id),
        { $set: updateObj },
        { runValidators: true },
      )
      .exec();

    return (await this.findByMongoIdOrJobId(id)) as JobDocument;
  }

  async completeFitterWorkflow(
    id: string,
    dto: FitterWorkflowDto,
  ): Promise<JobDocument> {
    const job = await this.findByMongoIdOrJobId(id);
    if (!job) {
      throw new NotFoundException(`Job with id ${id} was not found`);
    }

    const updateObj: Record<string, any> = {
      status: JobStatus.Completed,
      fittingCompletedAt: new Date(),
    };
    if (dto.photos && dto.photos.length > 0) {
      const existingPhotos = job.photos || (job as any).fittingPhotos || [];
      updateObj.photos = Array.from(
        new Set([...existingPhotos, ...dto.photos]),
      );
    }
    if (dto.notes) {
      updateObj.fittingNotes = dto.notes;
    }

    await this.jobModel
      .findOneAndUpdate(
        this.getIdentifierFilter(id),
        { $set: updateObj },
        { runValidators: true },
      )
      .exec();

    return (await this.findByMongoIdOrJobId(id)) as JobDocument;
  }

  private async applySalesmanWorkflow(
    id: string,
    workflowDto: SalesmanWorkflowDto,
    state: {
      jobStatus: JobStatus;
      timestamps: Record<string, Date>;
    },
  ): Promise<JobDocument> {
    const currentJob = await this.findByMongoIdOrJobId(id);
    if (!currentJob) {
      throw new NotFoundException(`Job with id ${id} was not found`);
    }

    const salesmanId = (
      workflowDto.salesmanId || currentJob.assignedSalesman
    )?.toString();

    const updatedJob = await this.jobModel
      .findOneAndUpdate(
        this.getIdentifierFilter(id),
        {
          status: state.jobStatus,
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
        .findByIdAndUpdate(salesmanId, { runValidators: true })
        .exec();

      await this.liveLocationService.updateLiveStatus(salesmanId);

      try {
        this.liveLocationGateway.server
          .to('live-location:managers')
          .emit('salesman:status-changed', {
            userId: salesmanId,
            role: 'Salesman',
            jobId: id,
          });
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
      .populate(
        'assignedSalesManager',
        'name email role phone checkedIn',
      )
      .populate(
        'assignedSalesman',
        'name email role phone checkedIn',
      )
      .populate('assignedFitter', 'name email role phone checkedIn')
      .exec();
  }

  private getIdentifierFilter(id: string): Record<string, unknown> {
    if (isValidObjectId(id)) {
      return { _id: id };
    }

    return {
      $or: [
        { jobId: id },
        { jobId: id.toUpperCase() },
        { _id: id },
      ],
    };
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
