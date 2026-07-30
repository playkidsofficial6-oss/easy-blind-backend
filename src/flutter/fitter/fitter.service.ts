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
        const fitterStr = assignedFitter ? assignedFitter.toString() : '';

        const fitterFilter = {
            $or: [
                ...(fitterObjectId ? [{ assignedFitter: fitterObjectId }] : []),
                ...(fitterStr ? [{ assignedFitter: fitterStr }] : []),
            ],
        };

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
        const endOfTomorrow = new Date(endOfToday.getTime() + 24 * 60 * 60 * 1000);

        const jobs = await this.jobModel
            .find({ ...fitterFilter, scheduledAt: { $gte: startOfToday, $lte: endOfToday }, status: { $in: [JobStatus.FitterAssigned, JobStatus.FitterOnTheWay, JobStatus.FitterReached, JobStatus.Fitting, JobStatus.TakingPhotos] } })
            .populate('assignedSalesManager', 'name email role phone status liveStatus')
            .populate('assignedSalesman', 'name email role phone status liveStatus')
            .populate('assignedFitter', 'name email role phone status liveStatus')
            .sort({ scheduledAt: 1, createdAt: -1 })
            .exec();

        const todayJobs: JobDocument[] = jobs;
        let tommorow = 0;
        let upcoming = 0;
        let completed = 0;
        let cancelled = 0;

        tommorow = await this.jobModel.countDocuments({ ...fitterFilter, status: JobStatus.FitterAssigned, scheduledAt: { $gte: startOfTomorrow, $lte: endOfTomorrow } }).exec();
        upcoming = await this.jobModel.countDocuments({ ...fitterFilter, status: JobStatus.FitterAssigned, scheduledAt: { $gte: startOfToday, $lte: endOfToday } }).exec();
        completed = await this.jobModel.countDocuments({ ...fitterFilter, status: { $in: [JobStatus.Completed] } }).exec();
        cancelled = await this.jobModel.countDocuments({ ...fitterFilter, status: { $in: [JobStatus.FitterCancelled, JobStatus.Cancelled] } }).exec();

        return {
            message: "All home page datas are fetched successfully",
            data: {
                tommorow,
                upcoming,
                completed,
                cancelled,
                todayJobs
            }
        };
    }

    async myJobs(assignedFitter: mongoose.Types.ObjectId | string, query: MyJobsFilterDto): Promise<MyJobResponseType> {

        const mongoQuery: any = { assignedFitter };

        if (query?.status) {
            mongoQuery.status = query.status;
        }
        if (query?.priority) {
            mongoQuery.priority = query.priority;
        }

        if (query?.propertyType) {
            mongoQuery.propertyType = query.propertyType;
        }

        if (query?.q) {
            mongoQuery.$or = [
                {
                    firstName: {
                        $regex: query.q,
                        $options: 'i',
                    },
                },
                {
                    lastName: {
                        $regex: query.q,
                        $options: 'i',
                    },
                },
                {
                    address: {
                        $regex: query.q,
                        $options: 'i',
                    },
                },
            ];
        }

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
        const endOfTomorrow = new Date(endOfToday.getTime() + 24 * 60 * 60 * 1000);

        const startOfWeek = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
        const endOfWeek = new Date(endOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

        const startOfMonth = new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000);
        const endOfMonth = new Date(endOfToday.getTime() + 30 * 24 * 60 * 60 * 1000);

        const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
        const endOfYesterday = new Date(endOfToday.getTime() - 24 * 60 * 60 * 1000);

        if (query.date === "Today") {
            mongoQuery.scheduledAt = { $gte: startOfToday, $lte: endOfToday };
        }
        if (query.date === "Tomorrow") {
            mongoQuery.scheduledAt = { $gte: startOfTomorrow, $lte: endOfTomorrow };
        }
        if (query.date === "Yesterday") {
            mongoQuery.scheduledAt = { $gte: startOfYesterday, $lte: endOfYesterday };
        }
        if (query.date === "Week") {
            mongoQuery.scheduledAt = { $gte: startOfWeek, $lte: endOfWeek };
        }
        if (query.date === "Month") {
            mongoQuery.scheduledAt = { $gte: startOfMonth, $lte: endOfMonth };
        }

        const jobs = await this.jobModel
            .find(mongoQuery)
            .populate('assignedSalesManager', 'name email role phone status liveStatus')
            .populate('assignedSalesman', 'name email role phone status liveStatus')
            .populate('assignedFitter', 'name email role phone status liveStatus')
            .sort({ scheduledAt: 1, createdAt: -1 })
            .exec();

        return {
            message: "My job page datas are fetched successfully",
            data: jobs,
        };
    }

    async jobStatus(fitterId: mongoose.Types.ObjectId | string, jobId: string, dto: JobStatusDto) {
        if (!Types.ObjectId.isValid(jobId)) {
            throw new BadRequestException("Invalid job ID");
        }


        const job = await this.jobModel.findOne({
            _id: new Types.ObjectId(jobId),
            assignedFitter: fitterId,
        });

        if (!job) {
            throw new NotFoundException("Job not found or not assigned to you");
        }

        job.status = dto.status;
        job.customerNote = dto.customerNote;
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
        const fitterStr = fitterId ? fitterId.toString() : '';

        const job = await this.jobModel.findOne({
            _id: new Types.ObjectId(jobId),
            $or: [
                ...(fitterObjectId ? [{ assignedFitter: fitterObjectId }] : []),
                ...(fitterStr ? [{ assignedFitter: fitterStr }] : []),
            ],
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
        const fitterObjectId = Types.ObjectId.isValid(fitterId) ? new Types.ObjectId(fitterId) : null;
        const fitterStr = fitterId ? fitterId.toString() : '';

        const job = await this.jobModel.findOne({
            _id: jobObjectId,
            $or: [
                ...(fitterObjectId ? [{ assignedFitter: fitterObjectId }] : []),
                ...(fitterStr ? [{ assignedFitter: fitterStr }] : []),
            ],
        })
            .populate('assignedSalesManager', 'name email role phone status liveStatus')
            .populate('assignedSalesman', 'name email role phone status liveStatus')
            .populate('assignedFitter', 'name email role phone status liveStatus')
            .exec();

        if (!job) {
            throw new NotFoundException("Job not found or not assigned to you");
        }

        return {
            message: "Job details fetched successfully",
            data: job,
        };
    }

    async completedJobs(user: mongoose.Types.ObjectId | string) {
        const isHexId = Types.ObjectId.isValid(user);
        const userObjectId = isHexId ? new Types.ObjectId(user) : null;
        const userStr = user ? user.toString() : '';

        const jobs = await this.jobModel.find({
            $or: [
                ...(userObjectId ? [{ assignedFitter: userObjectId }] : []),
                ...(userStr ? [{ assignedFitter: userStr }] : []),
            ],
            status: { $in: [JobStatus.Completed] },
        }).populate('assignedSalesManager', 'name email role phone status liveStatus')
            .populate('assignedSalesman', 'name email role phone status liveStatus')
            .populate('assignedFitter', 'name email role phone status liveStatus')
            .sort({ scheduledAt: 1, createdAt: -1 })
            .exec();
        return {
            message: "Completed jobs fetched successfully",
            data: jobs,
        };
    }
}

interface HomeResponseType {
    message: string;
    data: {
        tommorow: number;
        upcoming: number;
        completed: number;
        cancelled: number;
        todayJobs: JobDocument[];
    };
}

interface MyJobResponseType {
    message: string;
    data: JobDocument[];
}
