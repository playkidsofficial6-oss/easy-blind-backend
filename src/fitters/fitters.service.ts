import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateFitterDto } from './dto/create-fitter.dto';
import { UpdateFitterDto } from './dto/update-fitter.dto';
import { FitterProfileStatus } from './fitter-status.enum';
import {
  LiveUserStatus,
  User,
  UserDocument,
  UserLocation,
  UserRole,
} from '../users/schemas/user.schema';

interface FitterUserResponse {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  avatar?: string;
  liveStatus?: LiveUserStatus;
  location?: UserLocation;
  maxDailyJobs?: number;
}

export interface FitterResponse {
  _id?: string;
  userId: string;
  user: FitterUserResponse;
  phone?: string;
  location?: UserLocation;
  status: FitterProfileStatus | LiveUserStatus;
  capacity: number;
  skills: string[];
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

type UserPlainObject = User & {
  _id: { toString(): string };
  createdAt?: Date;
  updatedAt?: Date;
};

@Injectable()
export class FittersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async create(createFitterDto: CreateFitterDto): Promise<FitterResponse> {
    const user = await this.findFitterUser(createFitterDto.userId);
    const updatePayload = this.toUserUpdatePayload(createFitterDto);

    const updatedUser = await this.userModel
      .findByIdAndUpdate(user._id, { $set: updatePayload }, { new: true })
      .exec();

    return this.toResponse(updatedUser || user);
  }

  async findAll(): Promise<FitterResponse[]> {
    const users = await this.userModel
      .find({ role: UserRole.Fitter })
      .sort({ createdAt: -1 })
      .exec();

    return users.map((user) => this.toResponse(user));
  }

  async findByUserId(userId: string): Promise<FitterResponse> {
    const user = await this.findFitterUser(userId);
    return this.toResponse(user);
  }

  async upsertByUserId(
    userId: string,
    updateFitterDto: UpdateFitterDto,
  ): Promise<FitterResponse> {
    const user = await this.findFitterUser(userId);
    const updatePayload = this.toUserUpdatePayload(updateFitterDto);

    const updatedUser = await this.userModel
      .findByIdAndUpdate(user._id, { $set: updatePayload }, { new: true })
      .exec();

    return this.toResponse(updatedUser || user);
  }

  private async findFitterUser(userId: string): Promise<UserDocument> {
    const user = await this.userModel
      .findOne({ _id: userId, role: UserRole.Fitter })
      .exec();

    if (!user) {
      throw new NotFoundException('Fitter user not found');
    }

    return user;
  }

  private toUserUpdatePayload(
    dto: CreateFitterDto | UpdateFitterDto,
  ): Partial<User> {
    const payload: Partial<User> = {};

    if (dto.phone !== undefined) payload.phone = dto.phone.trim();
    if (dto.location !== undefined) {
      payload.location = {
        type: 'Point',
        coordinates: [dto.location.lng, dto.location.lat],
        address: dto.location.address,
        updatedAt: new Date(),
      };
    }
    if (dto.status !== undefined) {
      payload.liveStatus = dto.status as unknown as LiveUserStatus;
    }
    if (dto.capacity !== undefined) payload.maxDailyJobs = dto.capacity;
    if (dto.skills !== undefined) {
      payload.skills = dto.skills.map((skill) => skill.trim()).filter(Boolean);
    }
    if (dto.notes !== undefined) payload.notes = dto.notes.trim();

    return payload;
  }

  private toResponse(user: UserDocument): FitterResponse {
    const plainUser = user.toObject() as UserPlainObject;
    const userIdStr = plainUser._id.toString();

    return {
      _id: userIdStr,
      userId: userIdStr,
      user: {
        _id: userIdStr,
        name: plainUser.name,
        email: plainUser.email,
        role: plainUser.role,
        phone: plainUser.phone,
        avatar: plainUser.avatar,
        liveStatus: plainUser.liveStatus,
        location: plainUser.location,
        maxDailyJobs: plainUser.maxDailyJobs,
      },
      phone: plainUser.phone,
      location: plainUser.location,
      status: (plainUser.liveStatus as FitterProfileStatus) ?? FitterProfileStatus.Available,
      capacity: plainUser.maxDailyJobs ?? 5,
      skills: plainUser.skills ?? [],
      notes: plainUser.notes,
      createdAt: plainUser.createdAt,
      updatedAt: plainUser.updatedAt,
    };
  }
}
