import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model, Types } from 'mongoose';
import { Job, JobDocument, JobStatus } from '../../jobs/schemas/job.schema';
import { MyJobsFilterDto } from './dto/my-job-filter.dto';
import { JobStatusDto } from './dto/job-status-change.dto';
import { AuthUser } from 'src/helpers/AuthUser.type';

@Injectable()
export class SalesManService {
    constructor(
        @InjectModel(Job.name) private readonly jobModel: Model<JobDocument>
    ) { }

    async home(assignedSalesman: mongoose.Types.ObjectId | string): Promise<HomeResponseType> {

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
        const endOfTomorrow = new Date(endOfToday.getTime() + 24 * 60 * 60 * 1000);


        const jobs = await this.jobModel
            .find({ assignedSalesman, scheduledAt: { $gte: startOfToday, $lte: endOfToday }, status: { $in: [JobStatus.SalesmanScheduled, JobStatus.SalesmanOnTheWay, JobStatus.FitterReached, JobStatus.Measuring, JobStatus.Quoting] } })
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

        tommorow = await this.jobModel.countDocuments({ assignedSalesman: assignedSalesman, status: JobStatus.SalesmanScheduled, scheduledAt: { $gte: startOfTomorrow, $lte: endOfTomorrow } }).exec();
        upcoming = await this.jobModel.countDocuments({ assignedSalesman: assignedSalesman, status: JobStatus.SalesmanScheduled, scheduledAt: { $gte: startOfToday, $lte: endOfToday } }).exec();
        completed = await this.jobModel.countDocuments({ assignedSalesman: assignedSalesman, status: { $in: [JobStatus.ReadyForFitting, JobStatus.FitterAssigned, JobStatus.FitterOnTheWay, JobStatus.FitterReached, JobStatus.FitterCancelled, JobStatus.Fitting, JobStatus.TakingPhotos, JobStatus.Completed] } }).exec();
        cancelled = await this.jobModel.countDocuments({ assignedSalesman: assignedSalesman, status: { $in: [JobStatus.SalesmanCancelled] } }).exec();




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

    async myJobs(assignedSalesman: mongoose.Types.ObjectId | string, query: MyJobsFilterDto): Promise<MyJobResponseType> {
        const isHexId = Types.ObjectId.isValid(assignedSalesman);
        const salesmanObjectId = isHexId ? new Types.ObjectId(assignedSalesman) : null;

        const baseSalesmanFilter = salesmanObjectId ? { assignedSalesman: salesmanObjectId } : {};

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

        const jobs = await this.jobModel
            .find(mongoQuery)
            .populate('assignedSalesManager', 'name email role phone status liveStatus')
            .populate('assignedSalesman', 'name email role phone status liveStatus')
            .populate('assignedFitter', 'name email role phone status liveStatus')
            .sort({ scheduledAt: 1, createdAt: -1 })
            .exec();

        const taskFilter = query?.date || 'All';
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
                        { assignedSalesman: salesmanObjectId },
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
        job.customerNote = dto.customerNote;
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
                        { assignedSalesman: salesmanObjectId },
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
            assignedSalesman: salesmanId,
        }).populate('assignedSalesManager', 'name email role phone status liveStatus')
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

    async completedJobs(user: mongoose.Types.ObjectId) {
        const isHexId = Types.ObjectId.isValid(user);
        if (!isHexId) {
            throw new BadRequestException("Invalid user ID");
        }
        const userObjectId = new Types.ObjectId(user);
        const jobs = await this.jobModel.find({
            assignedSalesman: userObjectId,
            status: { $in: [JobStatus.ReadyForFitting, JobStatus.FitterAssigned, JobStatus.FitterOnTheWay, JobStatus.FitterReached, JobStatus.FitterCancelled, JobStatus.Fitting, JobStatus.TakingPhotos, JobStatus.Completed] },
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
    message: string,
    data: {
        tommorow: number,
        upcoming: number,
        completed: number,
        cancelled: number,
        todayJobs: JobDocument[]
    }
}

interface MyJobResponseType {
    message: string,
    data: JobDocument[]

}