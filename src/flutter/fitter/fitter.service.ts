import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model, Types } from 'mongoose';
import { Job, JobDocument, JobStatus } from '../../jobs/schemas/job.schema';
import { MyJobsFilterDto } from './dto/my-job-filter.dto';
import { JobStatusDto } from '../sales-man/dto/job-status-change.dto';
import { HomeDto } from './dto/home.dto';
import { CompletedJobsDto } from './dto/completed-jobs.dto';
import { JobPhotosDto } from './dto/photos.dto';

@Injectable()
export class FitterService {
    constructor(
        @InjectModel(Job.name) private readonly jobModel: Model<JobDocument>,
    ) { }

    async home(
        assignedFitter: mongoose.Types.ObjectId | string,
        dto?: HomeDto,
    ): Promise<HomeResponseType> {
        const page = dto?.page ?? 1;
        const limit = dto?.limit ?? 10;

        const fitterFilter = {
            assignedFitter,
        };

        const now = new Date();
        const startOfToday = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            0,
            0,
            0,
            0,
        );
        const endOfToday = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            23,
            59,
            59,
            999,
        );

        const startOfTomorrow = new Date(
            startOfToday.getTime() + 24 * 60 * 60 * 1000,
        );
        const endOfTomorrow = new Date(endOfToday.getTime() + 24 * 60 * 60 * 1000);

        const jobs = await this.jobModel
            .find({
                ...fitterFilter,
                scheduledAt: { $gte: startOfToday, $lte: endOfToday },
                status: {
                    $in: [
                        JobStatus.FitterAssigned,
                        JobStatus.FitterOnTheWay,
                        JobStatus.FitterReached,
                        JobStatus.Fitting,
                        JobStatus.TakingPhotos,
                    ],
                },
            })
            .populate('assignedSalesManager', 'name email role phone checkedIn')
            .populate('assignedSalesman', 'name email role phone checkedIn')
            .populate('assignedFitter', 'name email role phone checkedIn')
            .sort({ scheduledAt: 1, createdAt: -1 })
            .limit(limit)
            .skip((page - 1) * limit)
            .exec();

        const todayJobs: JobDocument[] = jobs;
        let tommorow = 0;
        let upcoming = 0;
        let completed = 0;
        let cancelled = 0;

        tommorow = await this.jobModel
            .countDocuments({
                ...fitterFilter,
                status: JobStatus.FitterAssigned,
                scheduledAt: { $gte: startOfTomorrow, $lte: endOfTomorrow },
            })
            .exec();
        upcoming = await this.jobModel
            .countDocuments({
                ...fitterFilter,
                status: JobStatus.FitterAssigned,
                scheduledAt: { $gte: startOfToday, $lte: endOfToday },
            })
            .exec();
        completed = await this.jobModel
            .countDocuments({
                ...fitterFilter,
                status: { $in: [JobStatus.Completed] },
            })
            .exec();
        cancelled = await this.jobModel
            .countDocuments({
                ...fitterFilter,
                status: { $in: [JobStatus.FitterCancelled, JobStatus.Cancelled] },
            })
            .exec();

        const pagination = {
            page,
            limit,
            totalData: await this.jobModel.countDocuments({
                ...fitterFilter,
                scheduledAt: { $gte: startOfToday, $lte: endOfToday },
                status: {
                    $in: [
                        JobStatus.FitterAssigned,
                        JobStatus.FitterOnTheWay,
                        JobStatus.FitterReached,
                        JobStatus.Fitting,
                        JobStatus.TakingPhotos,
                    ],
                },
            }),
            totalPages: Math.ceil(
                (await this.jobModel.countDocuments({
                    ...fitterFilter,
                    scheduledAt: { $gte: startOfToday, $lte: endOfToday },
                    status: {
                        $in: [
                            JobStatus.FitterAssigned,
                            JobStatus.FitterOnTheWay,
                            JobStatus.FitterReached,
                            JobStatus.Fitting,
                            JobStatus.TakingPhotos,
                        ],
                    },
                })) / limit,
            ),
        };

        return {
            message: 'All home page datas are fetched successfully',
            data: {
                tommorow,
                upcoming,
                completed,
                cancelled,
                todayJobs,
            },
            pagination,
        };
    }

    async myJobs(
        assignedFitter: mongoose.Types.ObjectId | string,
        query?: MyJobsFilterDto,
    ): Promise<MyJobResponseType> {
        const page = query?.page ?? 1;
        const limit = query?.limit ?? 10;
        const mongoQuery: any = { assignedFitter };

        if (query?.status) {
            mongoQuery.status = query.status;
        } else {
            mongoQuery.status = {
                $in: [
                    JobStatus.FitterAssigned,
                    JobStatus.FitterOnTheWay,
                    JobStatus.FitterReached,
                    JobStatus.Fitting,
                    JobStatus.TakingPhotos,
                ],
            };
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
        const startOfToday = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            0,
            0,
            0,
            0,
        );
        const endOfToday = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            23,
            59,
            59,
            999,
        );

        const startOfTomorrow = new Date(
            startOfToday.getTime() + 24 * 60 * 60 * 1000,
        );
        const endOfTomorrow = new Date(endOfToday.getTime() + 24 * 60 * 60 * 1000);

        const startOfWeek = new Date(
            startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000,
        );
        const endOfWeek = new Date(endOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

        const startOfMonth = new Date(
            startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000,
        );
        const endOfMonth = new Date(
            endOfToday.getTime() + 30 * 24 * 60 * 60 * 1000,
        );

        const startOfYesterday = new Date(
            startOfToday.getTime() - 24 * 60 * 60 * 1000,
        );
        const endOfYesterday = new Date(endOfToday.getTime() - 24 * 60 * 60 * 1000);

        if (query?.date === 'Today') {
            mongoQuery.scheduledAt = { $gte: startOfToday, $lte: endOfToday };
        }
        if (query?.date === 'Tomorrow') {
            mongoQuery.scheduledAt = { $gte: startOfTomorrow, $lte: endOfTomorrow };
        }
        if (query?.date === 'Yesterday') {
            mongoQuery.scheduledAt = { $gte: startOfYesterday, $lte: endOfYesterday };
        }
        if (query?.date === 'Week') {
            mongoQuery.scheduledAt = { $gte: startOfWeek, $lte: endOfWeek };
        }
        if (query?.date === 'Month') {
            mongoQuery.scheduledAt = { $gte: startOfMonth, $lte: endOfMonth };
        }

        const jobs = await this.jobModel
            .find(mongoQuery)
            .populate('assignedSalesManager', 'name email role phone checkedIn')
            .populate('assignedSalesman', 'name email role phone checkedIn')
            .populate('assignedFitter', 'name email role phone checkedIn')
            .sort({ scheduledAt: 1, createdAt: -1 })
            .limit(limit)
            .skip((page - 1) * limit)
            .exec();

        const pagination = {
            page,
            limit,
            totalData: await this.jobModel.countDocuments(mongoQuery),
            totalPages: Math.ceil(
                (await this.jobModel.countDocuments(mongoQuery)) / limit,
            ),
        };

        return {
            message: 'My job page datas are fetched successfully',
            data: jobs,
            pagination,
        };
    }

    async jobStatus(
        fitterId: mongoose.Types.ObjectId | string,
        jobId: string,
        dto: JobStatusDto,
    ) {
        if (!Types.ObjectId.isValid(jobId)) {
            throw new BadRequestException('Invalid job ID');
        }

        const job = await this.jobModel.findOne({
            _id: new Types.ObjectId(jobId),
            assignedFitter: fitterId,
        });

        if (!job) {
            throw new NotFoundException('Job not found or not assigned to you');
        }

        job.status = dto.status;
        job.customerNote = dto.customerNote;
        await job.save();
        return {
            message: 'Job status updated successfully',
            data: job,
        };
    }

    async cancelJob(
        fitterId: mongoose.Types.ObjectId | string,
        jobId: string,
        dto: { reason: string },
    ) {
        if (!Types.ObjectId.isValid(jobId)) {
            throw new BadRequestException('Invalid job ID');
        }
        const job = await this.jobModel.findOne({
            _id: new Types.ObjectId(jobId),
            assignedFitter: fitterId,
        });

        if (!job) {
            throw new NotFoundException('Job not found or not assigned to you');
        }

        job.status = JobStatus.FitterCancelled;
        job.rescheduleRequest = { status: 'pending', requestedAt: new Date() };
        job.cancelReason = dto.reason;
        await job.save();
        return {
            message: 'Job cancelled successfully',
            data: job,
        };
    }

    async getJobById(fitterId: mongoose.Types.ObjectId | string, jobId: string) {
        const isHexId = Types.ObjectId.isValid(jobId);
        if (!isHexId) {
            throw new BadRequestException('Invalid job ID');
        }
        const jobObjectId = new Types.ObjectId(jobId);

        const job = await this.jobModel
            .findOne({
                _id: jobObjectId,
                assignedFitter: fitterId,
            })
            .populate('assignedSalesManager', 'name email role phone checkedIn')
            .populate('assignedSalesman', 'name email role phone checkedIn')
            .populate('assignedFitter', 'name email role phone checkedIn')
            .exec();

        if (!job) {
            throw new NotFoundException('Job not found or not assigned to you');
        }

        return {
            message: 'Job details fetched successfully',
            data: job,
        };
    }

    async completedJobs(
        user: mongoose.Types.ObjectId | string,
        query?: CompletedJobsDto,
    ) {
        const page = query?.page ?? 1;
        const limit = query?.limit ?? 10;
        const jobs = await this.jobModel
            .find({
                assignedFitter: user,
                status: { $in: [JobStatus.Completed] },
            })
            .populate('assignedSalesManager', 'name email role phone checkedIn')
            .populate('assignedSalesman', 'name email role phone checkedIn')
            .populate('assignedFitter', 'name email role phone checkedIn')
            .sort({ scheduledAt: 1, createdAt: -1 })
            .limit(limit)
            .skip((page - 1) * limit)
            .exec();

        const pagination = {
            page,
            limit,
            totalData: await this.jobModel.countDocuments({
                assignedFitter: user,
                status: { $in: [JobStatus.Completed] },
            }),
            totalPages: Math.ceil(
                (await this.jobModel.countDocuments({
                    assignedFitter: user,
                    status: { $in: [JobStatus.Completed] },
                })) / limit,
            ),
        };

        return {
            message: 'Completed jobs fetched successfully',
            data: jobs,
            pagination,
        };
    }

    async jobPhotos(
        userId: mongoose.Types.ObjectId,
        jobId: string,
        dto: JobPhotosDto,
    ) {
        if (!Types.ObjectId.isValid(jobId)) {
            throw new BadRequestException('Invalid job ID');
        }
        const job = await this.jobModel.findOne({
            _id: new Types.ObjectId(jobId),
            assignedFitter: userId,
        });

        if (!job) {
            throw new NotFoundException('Job not found or not assigned to you');
        }

        job.photos = dto.photos;
        job.remarks = dto.remarks;
        await job.save();
        return {
            message: 'Job photos updated successfully',
            data: job,
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
    pagination: {
        page: number;
        limit: number;
        totalData: number;
        totalPages: number;
    };
}

interface MyJobResponseType {
    message: string;
    data: JobDocument[];
    pagination: {
        page: number;
        limit: number;
        totalData: number;
        totalPages: number;
    };
}
