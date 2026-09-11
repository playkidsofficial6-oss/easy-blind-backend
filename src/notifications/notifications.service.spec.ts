import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { User } from '../users/schemas/user.schema';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockGateway: { sendToUser: jest.Mock };
  let mockUserModel: {
    findById: jest.Mock;
    updateOne: jest.Mock;
  };
  let mockConfigService: { get: jest.Mock };

  beforeEach(async () => {
    mockGateway = {
      sendToUser: jest.fn().mockReturnValue(true),
    };

    mockUserModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            _id: '507f1f77bcf86cd799439011',
            fcmTokens: ['mock-fcm-token-123'],
          }),
        }),
      }),
      updateOne: jest.fn().mockResolvedValue({}),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: NotificationsGateway, useValue: mockGateway },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getModelToken(User.name), useValue: mockUserModel },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should notify job assignment via Socket.IO with clear title and body', async () => {
    const result = await service.notifyJobAssigned({
      targetUserId: '507f1f77bcf86cd799439011',
      jobId: 'JOB-2026-0001',
      jobMongoId: '65b1234567890abcdef12345',
      customerName: 'Ahmed Al Mansoori',
      address: 'Villa 12, Palm Jumeirah, Dubai',
      role: 'Salesman',
      scheduledAt: new Date('2026-09-15T10:00:00.000Z'),
    });

    expect(result.socketDelivered).toBe(true);
    expect(mockGateway.sendToUser).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      'job:assigned',
      expect.objectContaining({
        type: 'JOB_ASSIGNED',
        title: 'New Job Assigned • #JOB-2026-0001',
        body: expect.stringContaining('Ahmed Al Mansoori'),
        jobId: 'JOB-2026-0001',
        jobMongoId: '65b1234567890abcdef12345',
        role: 'Salesman',
      }),
    );
  });

  it('should notify fitter job assignment properly', async () => {
    const result = await service.notifyJobAssigned({
      targetUserId: '507f1f77bcf86cd799439022',
      jobId: 'JOB-2026-0002',
      jobMongoId: '65b1234567890abcdef12346',
      customerName: 'Fatima Zahra',
      address: 'Apartment 402, Downtown, Dubai',
      role: 'Fitter',
    });

    expect(result.socketDelivered).toBe(true);
    expect(mockGateway.sendToUser).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439022',
      'job:assigned',
      expect.objectContaining({
        type: 'JOB_ASSIGNED',
        title: 'New Job Assigned • #JOB-2026-0002',
        body: expect.stringContaining('Fatima Zahra'),
        role: 'Fitter',
      }),
    );
  });
});
