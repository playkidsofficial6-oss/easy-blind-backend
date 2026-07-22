import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Job, JobDocument, JobStatus, SalesmanWorkflowStatus } from 'src/jobs/schemas/job.schema';

@Injectable()
export class SalesManService {
    constructor(
        @InjectModel(Job.name) private readonly jobModel: Model<JobDocument>
    ) { }

    async home(assignedSalesman: string): Promise<HomeResponseType> {
        const isHexId = Types.ObjectId.isValid(assignedSalesman);
        const salesmanObjectId = isHexId ? new Types.ObjectId(assignedSalesman) : null;

        const salesmanQuery = {
            $or: [
                ...(salesmanObjectId
                    ? [
                        { assignedSalesman: salesmanObjectId },
                        { assignedTo: salesmanObjectId },
                    ]
                    : []),
                { assignedSalesman: assignedSalesman },
                { assignedTo: assignedSalesman },
                { activeSalesmanId: assignedSalesman },
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
            message: "Home",
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