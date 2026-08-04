import { Test, TestingModule } from '@nestjs/testing';
import { LiveLocationGateway } from './live-location.gateway';
import { LiveLocationService } from './live-location.service';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { User } from '../../users/schemas/user.schema';

describe('LiveLocationGateway', () => {
  let gateway: LiveLocationGateway;

  const mockLiveLocationService = {
    trackLiveLocation: jest.fn(),
  };

  const mockJwtService = {
    verifyAsync: jest.fn(),
  };

  const mockUserModel = {
    findById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiveLocationGateway,
        { provide: LiveLocationService, useValue: mockLiveLocationService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: getModelToken(User.name), useValue: mockUserModel },
      ],
    }).compile();

    gateway = module.get<LiveLocationGateway>(LiveLocationGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
