import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model, Types } from 'mongoose';
import { Job, JobDocument, JobStatus } from '../../jobs/schemas/job.schema';
import { MyJobsFilterDto } from './dto/my-job-filter.dto';
import { JobStatusDto } from './dto/job-status-change.dto';

@Injectable()
export class SalesManService {
    constructor(
        @InjectModel(Job.name) private readonly jobModel: Model<JobDocument>
    ) { }

    async home(assignedSalesman: mongoose.Types.ObjectId | string): Promise<HomeResponseType> {
        const isHexId = Types.ObjectId.isValid(assignedSalesman);
        const salesmanObjectId = isHexId ? new Types.ObjectId(assignedSalesman) : null;
        const salesmanIdStr = assignedSalesman ? assignedSalesman.toString() : null;

        const salesmanQuery = {
            $or: [
                ...(salesmanObjectId
                    ? [
                        { assignedSalesman: salesmanObjectId },
                        { assignedTo: salesmanObjectId },
                    ]
                    : []),
                ...(salesmanIdStr
                    ? [
                        { activeSalesmanId: salesmanIdStr },
                    ]
                    : []),
            ],
        };

        const jobs = await this.jobModel
            .find(salesmanQuery)
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
            if (job.status === JobStatus.SalesmanScheduled) {
                scheduled++;
            }
            if (job.status === JobStatus.Completed || job.status === JobStatus.ReadyForFitting) {
                completed++;
                continue;
            }
            if (job.status === JobStatus.Cancelled || job.status === JobStatus.SalesmanCancelled) {
                cancelled++;
                continue;
            }

            const scheduledDate = job.scheduledAt ? new Date(job.scheduledAt) : null;

            const isJobToday =
                (scheduledDate && scheduledDate >= startOfToday && scheduledDate <= endOfToday) ||
                job.status === JobStatus.SalesmanOnTheWay ||
                job.status === JobStatus.Measuring;

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

    async myJobs(assignedSalesman: mongoose.Types.ObjectId | string, query: MyJobsFilterDto): Promise<MyJobResponseType> {
        const isHexId = Types.ObjectId.isValid(assignedSalesman);
        const salesmanObjectId = isHexId ? new Types.ObjectId(assignedSalesman) : null;
        const salesmanIdStr = assignedSalesman ? assignedSalesman.toString() : null;

        const baseSalesmanFilter = {
            $or: [
                ...(salesmanObjectId
                    ? [
                        { assignedSalesman: salesmanObjectId },
                        { assignedTo: salesmanObjectId },
                    ]
                    : []),
                ...(salesmanIdStr
                    ? [
                        { activeSalesmanId: salesmanIdStr },
                    ]
                    : []),
            ],
        };

        const mongoQuery: any = { ...baseSalesmanFilter };

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

        const filteredJobs = jobs.filter((job) => {
            const isCompleted =
                job.status === JobStatus.Completed ||
                job.status === JobStatus.ReadyForFitting;

            const isCancelled = job.status === JobStatus.Cancelled || job.status === JobStatus.SalesmanCancelled;

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
                job.status === JobStatus.SalesmanOnTheWay ||
                job.status === JobStatus.Measuring;

            if (taskFilter === 'Today') {
                return isToday;
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

    async jobStatus(salesmanId: mongoose.Types.ObjectId | string, jobId: string, dto: JobStatusDto) {
        if (!Types.ObjectId.isValid(jobId)) {
            throw new BadRequestException("Invalid job ID");
        }
        const salesmanObjectId = Types.ObjectId.isValid(salesmanId) ? new Types.ObjectId(salesmanId) : null;
        const job = await this.jobModel.findOne({
            _id: new Types.ObjectId(jobId),
            ...(salesmanObjectId
                ? {
                    $or: [
                        { assignedTo: salesmanObjectId },
                        { assignedSalesman: salesmanObjectId },
                    ],
                }
                : {}),
        });

        if (!job) {
            throw new NotFoundException("Job not found or not assigned to you");
        }
        console.log(dto);
        job.status = dto.status;
        await job.save();
        return {
            message: "Job status updated successfully",
            data: job,
        };
    }


    async cancelJob(salesmanId: mongoose.Types.ObjectId | string, jobId: string, dto: { reason: string }) {
        if (!Types.ObjectId.isValid(jobId)) {
            throw new BadRequestException("Invalid job ID");
        }
        const salesmanObjectId = Types.ObjectId.isValid(salesmanId) ? new Types.ObjectId(salesmanId) : null;
        const job = await this.jobModel.findOne({
            _id: new Types.ObjectId(jobId),
            ...(salesmanObjectId
                ? {
                    $or: [
                        { assignedTo: salesmanObjectId },
                        { assignedSalesman: salesmanObjectId },
                    ],
                }
                : {}),
        });

        if (!job) {
            throw new NotFoundException("Job not found or not assigned to you");
        }
        job.status = JobStatus.SalesmanCancelled;
        job.rescheduleRequest = { status: "pending", requestedAt: new Date() };
        job.cancelReason = dto.reason;
        await job.save();
        return {
            message: "Job cancelled successfully",
            data: job,
        };
    }

    async getJobById(salesmanId: mongoose.Types.ObjectId, jobId: string) {
        const isHexId = Types.ObjectId.isValid(jobId);
        if (!isHexId) {
            throw new BadRequestException("Invalid job ID");
        }
        const jobObjectId = new Types.ObjectId(jobId);

        const job = await this.jobModel.findOne({
            _id: jobObjectId,
            $or: [
                { assignedTo: salesmanId },
                { assignedSalesman: salesmanId },
            ]
        }).populate('assignedTo', 'name email role phone liveStatus')
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
    message: string,
    data: {
        tommorow: number,
        upcoming: number,
        pending: number,
        scheduled: number,
        completed: number,
        cancelled: number,
        delayed: number,
        todayJobs: JobDocument[]
    }
}

interface MyJobResponseType {
    message: string,
    data: JobDocument[]

}