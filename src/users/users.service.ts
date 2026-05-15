import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  LiveUserStatus,
  User,
  UserDocument,
  UserLocation,
  UserRole,
} from './schemas/user.schema';

export interface UserResponse {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  avatar?: string;
  liveStatus?: LiveUserStatus;
  location?: UserLocation;
  maxDailyJobs?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserWithPassword extends UserResponse {
  passwordHash: string;
}

const BCRYPT_SALT_ROUNDS = 12;

type UserPlainObject = User & {
  _id: { toString(): string };
  createdAt?: Date;
  updatedAt?: Date;
};

type UserUpdatePayload = Partial<
  Pick<
    User,
    | 'name'
    | 'email'
    | 'passwordHash'
    | 'role'
    | 'phone'
    | 'avatar'
    | 'liveStatus'
    | 'location'
    | 'maxDailyJobs'
  >
>;

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponse> {
    const normalizedEmail = createUserDto.email.toLowerCase().trim();
    const existingUser = await this.userModel.exists({
      email: normalizedEmail,
    });

    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(
      createUserDto.password,
      BCRYPT_SALT_ROUNDS,
    );

    try {
      const createdUser = await this.userModel.create({
        name: createUserDto.name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: createUserDto.role ?? UserRole.User,
      });

      return this.toResponse(createdUser);
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException('A user with this email already exists');
      }
      throw error;
    }
  }

  async findAll(): Promise<UserResponse[]> {
    const users = await this.userModel.find().sort({ createdAt: -1 }).exec();
    return users.map((user) => this.toResponse(user));
  }

  async findById(id: string): Promise<UserResponse> {
    const user = await this.userModel.findById(id).exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toResponse(user);
  }

  async findByEmail(email: string): Promise<UserResponse | null> {
    const user = await this.userModel
      .findOne({ email: email.toLowerCase().trim() })
      .exec();
    return user ? this.toResponse(user) : null;
  }

  async findByEmailWithPassword(
    email: string,
  ): Promise<UserWithPassword | null> {
    const user = await this.userModel
      .findOne({ email: email.toLowerCase().trim() })
      .select('+passwordHash')
      .exec();

    if (!user) return null;

    return {
      ...this.toResponse(user),
      passwordHash: user.passwordHash,
    };
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponse> {
    const updatePayload: UserUpdatePayload = {};

    if (updateUserDto.name !== undefined) {
      updatePayload.name = updateUserDto.name.trim();
    }

    if (updateUserDto.email !== undefined) {
      const normalizedEmail = updateUserDto.email.toLowerCase().trim();
      const existingUser = await this.userModel.exists({
        email: normalizedEmail,
        _id: { $ne: id },
      });

      if (existingUser) {
        throw new ConflictException('A user with this email already exists');
      }

      updatePayload.email = normalizedEmail;
    }

    if (updateUserDto.password !== undefined) {
      updatePayload.passwordHash = await bcrypt.hash(
        updateUserDto.password,
        BCRYPT_SALT_ROUNDS,
      );
    }

    if (updateUserDto.role !== undefined) {
      updatePayload.role = updateUserDto.role;
    }

    if (updateUserDto.phone !== undefined) {
      updatePayload.phone = updateUserDto.phone.trim();
    }

    if (updateUserDto.avatar !== undefined) {
      updatePayload.avatar = updateUserDto.avatar.trim();
    }

    if (updateUserDto.liveStatus !== undefined) {
      updatePayload.liveStatus = updateUserDto.liveStatus;
    }

    if (updateUserDto.location !== undefined) {
      updatePayload.location = {
        type: 'Point',
        coordinates: [updateUserDto.location.lng, updateUserDto.location.lat],
        address: updateUserDto.location.address,
        updatedAt: new Date(),
      };
    }

    if (updateUserDto.maxDailyJobs !== undefined) {
      updatePayload.maxDailyJobs = updateUserDto.maxDailyJobs;
    }

    try {
      const updatedUser = await this.userModel
        .findByIdAndUpdate(id, updatePayload, {
          new: true,
          runValidators: true,
        })
        .exec();

      if (!updatedUser) {
        throw new NotFoundException('User not found');
      }

      return this.toResponse(updatedUser);
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException('A user with this email already exists');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<{ deleted: true; id: string }> {
    const deletedUser = await this.userModel.findByIdAndDelete(id).exec();

    if (!deletedUser) {
      throw new NotFoundException('User not found');
    }

    return { deleted: true, id };
  }

  private toResponse(user: UserDocument): UserResponse {
    const plainUser = user.toObject() as UserPlainObject;

    return {
      _id: plainUser._id.toString(),
      name: plainUser.name,
      email: plainUser.email,
      role: plainUser.role,
      phone: plainUser.phone,
      avatar: plainUser.avatar,
      liveStatus: plainUser.liveStatus,
      location: plainUser.location,
      maxDailyJobs: plainUser.maxDailyJobs,
      createdAt: plainUser.createdAt,
      updatedAt: plainUser.updatedAt,
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
