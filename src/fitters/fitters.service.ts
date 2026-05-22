import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateFitterDto } from './dto/create-fitter.dto';
import { UpdateFitterDto } from './dto/update-fitter.dto';
import {
  Fitter,
  FitterDocument,
  FitterLocation,
  FitterProfileStatus,
} from './schemas/fitter.schema';
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
  location?: FitterLocation | UserLocation;
  status: FitterProfileStatus;
  capacity: number;
  skills: string[];
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

type UserPlainObject = User & {
  _id: { toString(): string };
};

type FitterPlainObject = Fitter & {
  _id: { toString(): string };
  userId: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

type FitterUpdatePayload = Partial<
  Pick<
    Fitter,
    'phone' | 'location' | 'status' | 'capacity' | 'skills' | 'notes'
  >
>;

@Injectable()
export class FittersService {
  constructor(
    @InjectModel(Fitter.name)
    private readonly fitterModel: Model<FitterDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async create(createFitterDto: CreateFitterDto): Promise<FitterResponse> {
    const user = await this.findFitterUser(createFitterDto.userId);

    try {
      const created = await this.fitterModel.create({
        userId: user._id,
        ...this.toUpdatePayload(createFitterDto),
      });

      return this.toResponse(user, created);
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException(
          'A fitter profile already exists for this user',
        );
      }
      throw error;
    }
  }

  async findAll(): Promise<FitterResponse[]> {
    const users = await this.userModel
      .find({ role: UserRole.Fitter })
      .sort({ createdAt: -1 })
      .exec();

    const userIds = users.map((user) => user._id);
    const profiles = await this.fitterModel
      .find({ userId: { $in: userIds } })
      .exec();
    const profilesByUserId = new Map(
      profiles.map((profile) => [profile.userId.toString(), profile]),
    );

    return users.map((user) =>
      this.toResponse(user, profilesByUserId.get(user._id.toString())),
    );
  }

  async findByUserId(userId: string): Promise<FitterResponse> {
    const user = await this.findFitterUser(userId);
    const profile = await this.fitterModel.findOne({ userId: user._id }).exec();
    return this.toResponse(user, profile ?? undefined);
  }

  async upsertByUserId(
    userId: string,
    updateFitterDto: UpdateFitterDto,
  ): Promise<FitterResponse> {
    const user = await this.findFitterUser(userId);
    const updated = await this.fitterModel
      .findOneAndUpdate(
        { userId: user._id },
        { $set: this.toUpdatePayload(updateFitterDto) },
        {
          returnDocument: 'after',
          runValidators: true,
          upsert: true,
          setDefaultsOnInsert: true,
        },
      )
      .exec();

    return this.toResponse(user, updated);
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

  private toUpdatePayload(
    dto: CreateFitterDto | UpdateFitterDto,
  ): FitterUpdatePayload {
    const payload: FitterUpdatePayload = {};

    if (dto.phone !== undefined) payload.phone = dto.phone.trim();
    if (dto.location !== undefined) {
      payload.location = {
        ...dto.location,
        updatedAt: new Date(),
      };
    }
    if (dto.status !== undefined) payload.status = dto.status;
    if (dto.capacity !== undefined) payload.capacity = dto.capacity;
    if (dto.skills !== undefined) {
      payload.skills = dto.skills.map((skill) => skill.trim()).filter(Boolean);
    }
    if (dto.notes !== undefined) payload.notes = dto.notes.trim();

    return payload;
  }

  private toResponse(
    user: UserDocument,
    profile?: FitterDocument,
  ): FitterResponse {
    const plainUser = user.toObject() as UserPlainObject;
    const plainProfile = profile?.toObject() as FitterPlainObject | undefined;

    return {
      _id: plainProfile?._id.toString(),
      userId: plainUser._id.toString(),
      user: {
        _id: plainUser._id.toString(),
        name: plainUser.name,
        email: plainUser.email,
        role: plainUser.role,
        phone: plainUser.phone,
        avatar: plainUser.avatar,
        liveStatus: plainUser.liveStatus,
        location: plainUser.location,
        maxDailyJobs: plainUser.maxDailyJobs,
      },
      phone: plainProfile?.phone ?? plainUser.phone,
      location: plainProfile?.location ?? plainUser.location,
      status: plainProfile?.status ?? FitterProfileStatus.Available,
      capacity: plainProfile?.capacity ?? plainUser.maxDailyJobs ?? 5,
      skills: plainProfile?.skills ?? [],
      notes: plainProfile?.notes,
      createdAt: plainProfile?.createdAt,
      updatedAt: plainProfile?.updatedAt,
    };
  }

  private isDuplicateKeyError(error: unknown): error is { code: number } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    );
  }
}
