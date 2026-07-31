import { Test, TestingModule } from '@nestjs/testing';
import { FitterController } from './fitter.controller';
import { FitterService } from './fitter.service';
import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../users/schemas/user.schema';
import { Types } from 'mongoose';
import { JobStatus } from '../../jobs/schemas/job.schema';

describe('FitterController', () => {
  let controller: FitterController;
  let fitterService: Partial<Record<keyof FitterService, jest.Mock>>;

  const mockFitterUserId = new Types.ObjectId();
  const mockFitterUser = {
    userId: mockFitterUserId,
    email: 'fitter@test.com',
    role: UserRole.Fitter,
  };

  const mockSalesmanUser = {
    userId: new Types.ObjectId(),
    email: 'salesman@test.com',
    role: UserRole.Salesman,
  };

  beforeEach(async () => {
    fitterService = {
      home: jest.fn().mockResolvedValue({ message: 'Home data', data: {} }),
      myJobs: jest.fn().mockResolvedValue({ message: 'My jobs', data: [] }),
      getJobById: jest
        .fn()
        .mockResolvedValue({ message: 'Job details', data: {} }),
      jobStatus: jest
        .fn()
        .mockResolvedValue({ message: 'Status updated', data: {} }),
      cancelJob: jest
        .fn()
        .mockResolvedValue({ message: 'Job cancelled', data: {} }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FitterController],
      providers: [
        {
          provide: FitterService,
          useValue: fitterService,
        },
      ],
    }).compile();

    controller = module.get<FitterController>(FitterController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('home', () => {
    it('should throw ForbiddenException if user is not a Fitter', async () => {
      await expect(
        controller.home({ user: mockSalesmanUser } as any, {} as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return home data for valid Fitter user', async () => {
      const dto = { page: 1, limit: 10 };
      const res = await controller.home({ user: mockFitterUser } as any, dto as any);
      expect(fitterService.home).toHaveBeenCalledWith(mockFitterUserId, dto);
      expect(res).toEqual({ message: 'Home data', data: {} });
    });
  });

  describe('myJobs', () => {
    it('should throw ForbiddenException if user is not a Fitter', async () => {
      await expect(
        controller.myJobs({ user: mockSalesmanUser } as any, {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return myJobs data for valid Fitter user', async () => {
      const query = { date: 'Today' };
      const res = await controller.myJobs(
        { user: mockFitterUser } as any,
        query,
      );
      expect(fitterService.myJobs).toHaveBeenCalledWith(
        mockFitterUserId,
        query,
      );
      expect(res).toEqual({ message: 'My jobs', data: [] });
    });
  });

  describe('getJobById', () => {
    it('should throw ForbiddenException if user is not a Fitter', async () => {
      await expect(
        controller.getJobById({ user: mockSalesmanUser } as any, 'job123'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return job details for valid Fitter user', async () => {
      const res = await controller.getJobById(
        { user: mockFitterUser } as any,
        'job123',
      );
      expect(fitterService.getJobById).toHaveBeenCalledWith(
        mockFitterUserId,
        'job123',
      );
      expect(res).toEqual({ message: 'Job details', data: {} });
    });
  });

  describe('jobStatus', () => {
    it('should throw ForbiddenException if user is not a Fitter', async () => {
      await expect(
        controller.jobStatus({ user: mockSalesmanUser } as any, 'job123', {
          status: JobStatus.Fitting,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update job status for valid Fitter user', async () => {
      const dto = { status: JobStatus.Fitting };
      const res = await controller.jobStatus(
        { user: mockFitterUser } as any,
        'job123',
        dto,
      );
      expect(fitterService.jobStatus).toHaveBeenCalledWith(
        mockFitterUserId,
        'job123',
        dto,
      );
      expect(res).toEqual({ message: 'Status updated', data: {} });
    });
  });

  describe('cancelJob', () => {
    it('should throw ForbiddenException if user is not a Fitter', async () => {
      await expect(
        controller.cancelJob({ user: mockSalesmanUser } as any, 'job123', {
          reason: 'Customer requested',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should cancel job for valid Fitter user', async () => {
      const dto = { reason: 'Customer requested' };
      const res = await controller.cancelJob(
        { user: mockFitterUser } as any,
        'job123',
        dto,
      );
      expect(fitterService.cancelJob).toHaveBeenCalledWith(
        mockFitterUserId,
        'job123',
        dto,
      );
      expect(res).toEqual({ message: 'Job cancelled', data: {} });
    });
  });
});
