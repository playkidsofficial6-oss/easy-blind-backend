import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model, Types } from 'mongoose';
import { Job, JobDocument, JobStatus } from '../../jobs/schemas/job.schema';
import { MyJobsFilterDto } from './dto/my-job-filter.dto';
import { JobStatusDto } from '../sales-man/dto/job-status-change.dto';

@Injectable()
export class FitterService {
    constructor(
        @InjectModel(Job.name) private readonly jobModel: Model<JobDocument>
    ) { }

    async home(assignedFitter: mongoose.Types.ObjectId | string): Promise<HomeResponseType> {
        const isHexId = Types.ObjectId.isValid(assignedFitter);
        const fitterObjectId = isHexId ? new Types.ObjectId(assignedFitter) : null;

        const fitterQuery = {
            $or: [
                ...(fitterObjectId
                    ? [
                        { assignedFitter: fitterObjectId },
                        { assignedTo: fitterObjectId },
                    ]
                    : []),
            ],
        };

        const jobs = await this.jobModel
            .find(fitterQuery)
            .populate('assignedTo', 'name email role phone liveStatus')
            .populate('assignedSalesman', 'name email role phone liveStatus')
            .populate('assignedBy', 'name email role phone liveStatus')
            .populate('assignedFitter', 'name email role phone liveStatus')
            .sort({ scheduledAt: 1, createdAt: -1 })
            .exec();

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
        const endOfTomorrow = new Date(endOfToday.getTime() + 24 * 60 * 60 * 1000);

        const todayJobs: JobDocument[] = [];
        let tommorow = 0;
        let upcoming = 0;
        let pending = 0;
        let scheduled = 0;
        let completed = 0;
        let cancelled = 0;
        let delayed = 0;

        for (const job of jobs) {
            if (job.status === JobStatus.Pending) {
                pending++;
            }
            if (job.status === JobStatus.FitterAssigned) {
                scheduled++;
            }
            if (job.status === JobStatus.Completed) {
                completed++;
                continue;
            }
            if (job.status === JobStatus.Cancelled || job.status === JobStatus.FitterCancelled || job.status === JobStatus.SalesmanCancelled) {
                cancelled++;
                continue;
            }

            const scheduledDate = job.scheduledAt ? new Date(job.scheduledAt) : null;

            const isJobToday =
                (scheduledDate && scheduledDate >= startOfToday && scheduledDate <= endOfToday) ||
                job.status === JobStatus.FitterOnTheWay ||
                job.status === JobStatus.FitterReached ||
                job.status === JobStatus.Fitting ||
                job.status === JobStatus.TakingPhotos;

            if (isJobToday) {
                todayJobs.push(job);
            } else if (scheduledDate) {
                if (scheduledDate >= startOfTomorrow && scheduledDate <= endOfTomorrow) {
                    tommorow++;
                } else if (scheduledDate > endOfTomorrow) {
                    upcoming++;
                } else if (scheduledDate < startOfToday) {
                    delayed++;
                }
            } else {
                upcoming++;
            }
        }

        return {
            message: "All home page datas are fetched successfully",
            data: {
                tommorow,
                upcoming,
                pending,
                scheduled,
                completed,
                cancelled,
                delayed,
                todayJobs
            }
        };
    }

    async myJobs(assignedFitter: mongoose.Types.ObjectId | string, query: MyJobsFilterDto): Promise<MyJobResponseType> {
        const isHexId = Types.ObjectId.isValid(assignedFitter);
        const fitterObjectId = isHexId ? new Types.ObjectId(assignedFitter) : null;

        const baseFitterFilter = {
            $or: [
                ...(fitterObjectId
                    ? [
                        { assignedFitter: fitterObjectId },
                        { assignedTo: fitterObjectId },
                    ]
                    : []),
            ],
        };

        const mongoQuery: any = { ...baseFitterFilter };

        if (query?.status) {
            mongoQuery.status = query.status;
        }
        if (query?.priority) {
            mongoQuery.priority = query.priority;
        }

        if (query?.propertyType) {
            mongoQuery.propertyType = query.propertyType;
        }

        const jobs = await this.jobModel
            .find(mongoQuery)
            .populate('assignedTo', 'name email role phone liveStatus')
            .populate('assignedSalesman', 'name email role phone liveStatus')
            .populate('assignedBy', 'name email role phone liveStatus')
            .populate('assignedFitter', 'name email role phone liveStatus')
            .sort({ scheduledAt: 1, createdAt: -1 })
            .exec();

        const taskFilter = (query as any)?.taskFilter || query?.date || 'All';
        if (taskFilter === 'All') {
            return {
                message: "My job page datas are fetched successfully",
                data: jobs,
            };
        }

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
        const endOfTomorrow = new Date(endOfToday.getTime() + 24 * 60 * 60 * 1000);

        const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
        const endOfYesterday = new Date(startOfToday.getTime() - 1);

        const dayOfWeek = now.getDay();
        const startOfWeek = new Date(startOfToday.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
        const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const filteredJobs = jobs.filter((job) => {
            const isCompleted = job.status === JobStatus.Completed;

            const isCancelled =
                job.status === JobStatus.Cancelled ||
                job.status === JobStatus.FitterCancelled ||
                job.status === JobStatus.SalesmanCancelled;

            if (taskFilter === 'Completed') {
                return isCompleted;
            }
            if (taskFilter === 'Cancelled') {
                return isCancelled;
            }

            if (isCompleted || isCancelled) {
                return false;
            }

            const scheduledDate = job.scheduledAt ? new Date(job.scheduledAt) : null;

            const isToday =
                (scheduledDate && scheduledDate >= startOfToday && scheduledDate <= endOfToday) ||
                job.status === JobStatus.FitterOnTheWay ||
                job.status === JobStatus.FitterReached ||
                job.status === JobStatus.Fitting ||
                job.status === JobStatus.TakingPhotos;

            if (taskFilter === 'Today') {
                return isToday;
            }

            if (taskFilter === 'Yesterday') {
                return !!(scheduledDate && scheduledDate >= startOfYesterday && scheduledDate <= endOfYesterday);
            }

            if (taskFilter === 'Week') {
                return !!(scheduledDate && scheduledDate >= startOfWeek && scheduledDate <= endOfWeek);
            }

            if (taskFilter === 'Month') {
                return !!(scheduledDate && scheduledDate >= startOfMonth && scheduledDate <= endOfMonth);
            }

            if (isToday) {
                return false;
            }

            if (scheduledDate) {
                if (scheduledDate >= startOfTomorrow && scheduledDate <= endOfTomorrow) {
                    return taskFilter === 'Tomorrow';
                }
                if (scheduledDate > endOfTomorrow) {
                    return taskFilter === 'Upcoming';
                }
                if (scheduledDate < startOfToday) {
                    return taskFilter === 'Delayed';
                }
            } else {
                return taskFilter === 'Upcoming';
            }

            return false;
        });

        return {
            message: "My job page datas are fetched successfully",
            data: filteredJobs,
        };
    }

    async jobStatus(fitterId: mongoose.Types.ObjectId | string, jobId: string, dto: JobStatusDto) {
        if (!Types.ObjectId.isValid(jobId)) {
            throw new BadRequestException("Invalid job ID");
        }
        const fitterObjectId = Types.ObjectId.isValid(fitterId) ? new Types.ObjectId(fitterId) : null;

        const job = await this.jobModel.findOne({
            _id: new Types.ObjectId(jobId),
            ...(fitterObjectId
                ? {
                    $or: [
                        { assignedTo: fitterObjectId },
                        { assignedFitter: fitterObjectId },
                    ],
                }
                : {}),
        });

        if (!job) {
            throw new NotFoundException("Job not found or not assigned to you");
        }

        job.status = dto.status;
        await job.save();
        return {
            message: "Job status updated successfully",
            data: job,
        };
    }

    async cancelJob(fitterId: mongoose.Types.ObjectId | string, jobId: string, dto: { reason: string }) {
        if (!Types.ObjectId.isValid(jobId)) {
            throw new BadRequestException("Invalid job ID");
        }
        const fitterObjectId = Types.ObjectId.isValid(fitterId) ? new Types.ObjectId(fitterId) : null;

        const job = await this.jobModel.findOne({
            _id: new Types.ObjectId(jobId),
            ...(fitterObjectId
                ? {
                    $or: [
                        { assignedTo: fitterObjectId },
                        { assignedFitter: fitterObjectId },
                    ],
                }
                : {}),
        });

        if (!job) {
            throw new NotFoundException("Job not found or not assigned to you");
        }

        job.status = JobStatus.FitterCancelled;
        job.rescheduleRequest = { status: "pending", requestedAt: new Date() };
        job.cancelReason = dto.reason;
        await job.save();
        return {
            message: "Job cancelled successfully",
            data: job,
        };
    }

    async getJobById(fitterId: mongoose.Types.ObjectId | string, jobId: string) {
        const isHexId = Types.ObjectId.isValid(jobId);
        if (!isHexId) {
            throw new BadRequestException("Invalid job ID");
        }
        const jobObjectId = new Types.ObjectId(jobId);
        const isFitterHexId = Types.ObjectId.isValid(fitterId);
        const fitterObjectId = isFitterHexId ? new Types.ObjectId(fitterId) : null;

        const job = await this.jobModel.findOne({
            _id: jobObjectId,
            $or: [
                ...(fitterObjectId
                    ? [
                        { assignedTo: fitterObjectId },
                        { assignedFitter: fitterObjectId },
                    ]
                    : []),
            ],
        })
            .populate('assignedTo', 'name email role phone liveStatus')
            .populate('assignedSalesman', 'name email role phone liveStatus')
            .populate('assignedBy', 'name email role phone liveStatus')
            .populate('assignedFitter', 'name email role phone liveStatus')
            .exec();

        if (!job) {
            throw new NotFoundException("Job not found or not assigned to you");
        }

        return {
            message: "Job details fetched successfully",
            data: job,
        };
    }
}

interface HomeResponseType {
    message: string;
    data: {
        tommorow: number;
        upcoming: number;
        pending: number;
        scheduled: number;
        completed: number;
        cancelled: number;
        delayed: number;
        todayJobs: JobDocument[];
    };
}

interface MyJobResponseType {
    message: string;
    data: JobDocument[];
}
