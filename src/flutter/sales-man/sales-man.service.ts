import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model, Types } from 'mongoose';
import { Job, JobDocument, JobStatus, SalesmanWorkflowStatus } from 'src/jobs/schemas/job.schema';
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
            if (job.status === JobStatus.Scheduled) {
                scheduled++;
            }
            if (job.status === JobStatus.Completed || job.salesmanWorkflowStatus === SalesmanWorkflowStatus.Completed) {
                completed++;
                continue;
            }
            if (job.status === JobStatus.Cancelled) {
                cancelled++;
                continue;
            }

            const scheduledDate = job.scheduledAt ? new Date(job.scheduledAt) : null;

            const isJobToday =
                (scheduledDate && scheduledDate >= startOfToday && scheduledDate <= endOfToday) ||
                job.salesmanWorkflowStatus === SalesmanWorkflowStatus.Travelling ||
                job.salesmanWorkflowStatus === SalesmanWorkflowStatus.Measuring ||
                job.status === JobStatus.InProgress;

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
        if (query?.workflowStatus) {
            mongoQuery.salesmanWorkflowStatus = query.workflowStatus;
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
                job.salesmanWorkflowStatus === SalesmanWorkflowStatus.Completed;

            const isCancelled = job.status === JobStatus.Cancelled;

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
                job.salesmanWorkflowStatus === SalesmanWorkflowStatus.Travelling ||
                job.salesmanWorkflowStatus === SalesmanWorkflowStatus.Measuring ||
                job.status === JobStatus.InProgress;

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
        const job = await this.jobModel.findById(jobId);
        if (!job) {
            throw new BadRequestException("Job not found");
        }
        console.log(dto)
        job.status = dto.status;
        job.salesmanWorkflowStatus = dto.salesmanWorkflowStatus;
        await job.save();
        return {
            message: "Job status updated successfully",
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