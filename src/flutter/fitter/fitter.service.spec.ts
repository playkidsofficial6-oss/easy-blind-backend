import { Test, TestingModule } from '@nestjs/testing';
import { FitterService } from './fitter.service';
import { getModelToken } from '@nestjs/mongoose';
import { Job, JobStatus } from '../../jobs/schemas/job.schema';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

describe('FitterService', () => {
  let service: FitterService;
  let jobModelMock: any;

  const mockFitterId = new Types.ObjectId();
  const mockValidJobId = new Types.ObjectId().toHexString();

  const mockJobDoc = (overrides = {}) => {
    const doc: any = {
      _id: new Types.ObjectId(mockValidJobId),
      status: JobStatus.FitterAssigned,
      scheduledAt: new Date(),
      assignedFitter: mockFitterId,
      save: jest.fn().mockImplementation(function () {
        return Promise.resolve(this);
      }),
      ...overrides,
    };
    return doc;
  };

  beforeEach(async () => {
    jobModelMock = {
      find: jest.fn(),
      findById: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FitterService,
        {
          provide: getModelToken(Job.name),
          useValue: jobModelMock,
        },
      ],
    }).compile();

    service = module.get<FitterService>(FitterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getJobById', () => {
    it('should throw BadRequestException if jobId is invalid', async () => {
      await expect(service.getJobById(mockFitterId, 'invalid-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if job is not found or not assigned', async () => {
      jobModelMock.findOne.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.getJobById(mockFitterId, mockValidJobId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return job details if found and assigned', async () => {
      const job = mockJobDoc();
      jobModelMock.findOne.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(job),
      });

      const res = await service.getJobById(mockFitterId, mockValidJobId);
      expect(res.message).toBe('Job details fetched successfully');
      expect(res.data).toBe(job);
    });
  });

  describe('jobStatus', () => {
    it('should throw BadRequestException if jobId is invalid', async () => {
      await expect(
        service.jobStatus(mockFitterId, 'invalid-id', { status: JobStatus.Fitting }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if job is not found or not assigned', async () => {
      jobModelMock.findOne.mockResolvedValue(null);

      await expect(
        service.jobStatus(mockFitterId, mockValidJobId, { status: JobStatus.Fitting }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update job status when job is assigned to fitter', async () => {
      const job = mockJobDoc();
      jobModelMock.findOne.mockResolvedValue(job);

      const res = await service.jobStatus(mockFitterId, mockValidJobId, {
        status: JobStatus.Fitting,
      });

      expect(job.status).toBe(JobStatus.Fitting);
      expect(job.save).toHaveBeenCalled();
      expect(res.message).toBe('Job status updated successfully');
    });
  });

  describe('cancelJob', () => {
    it('should throw BadRequestException if jobId is invalid', async () => {
      await expect(
        service.cancelJob(mockFitterId, 'invalid-id', { reason: 'Cancelled by client' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if job is not found or not assigned', async () => {
      jobModelMock.findOne.mockResolvedValue(null);

      await expect(
        service.cancelJob(mockFitterId, mockValidJobId, { reason: 'Cancelled by client' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update job status to FitterCancelled and set cancellation details', async () => {
      const job = mockJobDoc();
      jobModelMock.findOne.mockResolvedValue(job);

      const res = await service.cancelJob(mockFitterId, mockValidJobId, {
        reason: 'Client unavailable',
      });

      expect(job.status).toBe(JobStatus.FitterCancelled);
      expect(job.cancelReason).toBe('Client unavailable');
      expect(job.rescheduleRequest).toBeDefined();
      expect(job.save).toHaveBeenCalled();
      expect(res.message).toBe('Job cancelled successfully');
    });
  });

  describe('home', () => {
    it('should return home page statistics and today jobs', async () => {
      const today = new Date();
      const jobToday = mockJobDoc({ scheduledAt: today, status: JobStatus.FitterAssigned });
      const jobPending = mockJobDoc({ scheduledAt: null, status: JobStatus.Pending });
      const jobCompleted = mockJobDoc({ scheduledAt: null, status: JobStatus.Completed });

      jobModelMock.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([jobToday, jobPending, jobCompleted]),
      });

      const res = await service.home(mockFitterId);
      expect(res.message).toBe('All home page datas are fetched successfully');
      expect(res.data.pending).toBe(1);
      expect(res.data.completed).toBe(1);
      expect(res.data.todayJobs).toHaveLength(1);
    });
  });

  describe('myJobs', () => {
    it('should return filtered jobs based on query taskFilter', async () => {
      const jobToday = mockJobDoc({ status: JobStatus.Fitting, scheduledAt: new Date() });

      jobModelMock.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([jobToday]),
      });

      const res = await service.myJobs(mockFitterId, { date: 'Today' });
      expect(res.message).toBe('My job page datas are fetched successfully');
      expect(res.data).toHaveLength(1);
    });
  });
});
