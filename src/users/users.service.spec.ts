import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { User, UserRole } from './schemas/user.schema';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { NotFoundException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let mockUserModel: any;

  beforeEach(async () => {
    mockUserModel = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findOneAndUpdate: jest.fn(),
      exists: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn(), verifyAsync: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(), getOrThrow: jest.fn() },
        },
        {
          provide: MailService,
          useValue: { sendPasswordResetEmail: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should soft delete user, set checkedIn to false, and clear refreshToken', async () => {
    const mockUser = {
      _id: '507f1f77bcf86cd799439011',
      name: 'John Doe',
      email: 'john@example.com',
      role: UserRole.Salesman,
      checkedIn: true,
      refreshToken: 'somehashedtoken',
      isDeleted: false,
      toObject: jest.fn().mockReturnValue({
        _id: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        email: 'john@example.com',
        role: UserRole.Salesman,
        checkedIn: true,
      }),
    };

    mockUserModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockUser),
    });

    mockUserModel.findByIdAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ ...mockUser, isDeleted: true, checkedIn: false }),
    });

    const result = await service.softDelete('507f1f77bcf86cd799439011');

    expect(mockUserModel.findOne).toHaveBeenCalledWith({
      _id: '507f1f77bcf86cd799439011',
      isDeleted: { $ne: true },
    });
    expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      {
        $set: { isDeleted: true, checkedIn: false },
        $unset: { refreshToken: 1 },
      },
      { returnDocument: 'after' },
    );
    expect(result).toEqual({ message: 'User deleted successfully' });
  });

  it('should throw NotFoundException when trying to soft delete non-existent or deleted user', async () => {
    mockUserModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(service.softDelete('507f1f77bcf86cd799439011')).rejects.toThrow(
      NotFoundException,
    );
  });
});
