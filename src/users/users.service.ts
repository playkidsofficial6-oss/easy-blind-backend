import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import mongoose, { Model } from 'mongoose';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  User,
  UserDocument,
  UserLocation,
  UserRole,
} from './schemas/user.schema';
import { ConfigService } from '@nestjs/config';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { JwtService } from '@nestjs/jwt';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { MailService } from '../mail/mail.service';

export interface UserResponse {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  phoneNumber?: string;
  location?: UserLocation;
  checkedIn?: boolean;
  activeTaskId?: string;
  activeTaskStatus?: string;
  currentTaskAssignedAt?: Date;
  lastKnownLat?: number;
  lastKnownLng?: number;
  lastLocationUpdatedAt?: Date;
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
    'name' | 'email' | 'phoneNumber' | 'passwordHash' | 'role' | 'location'
  >
>;

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) { }

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
        phoneNumber: createUserDto.phoneNumber?.trim(),
        passwordHash,
        role: createUserDto.role ?? UserRole.User,
      });

      return this.toResponse(createdUser);
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        console.log(error)
        throw new ConflictException('A user with this email already exists');
      }
      throw error;
    }
  }

  async findAll(): Promise<UserResponse[]> {
    const users = await this.userModel.find().sort({ createdAt: -1 }).exec();
    return users.map((user) => this.toResponse(user));
  }

  async findFitters(): Promise<any[]> {
    const users = await this.userModel
      .find({ role: UserRole.Fitter })
      .sort({ createdAt: -1 })
      .exec();

    return users.map((user) => {
      const plainUser = user.toObject() as any;
      const userIdStr = plainUser._id.toString();
      return {
        _id: userIdStr,
        userId: userIdStr,
        user: this.toResponse(user),
        phone: plainUser.phoneNumber,
        location: plainUser.location,
        status: plainUser.status ?? 'Available',
        capacity: 5,
        createdAt: plainUser.createdAt,
        updatedAt: plainUser.updatedAt,
      };
    });
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

    const rawPhone = updateUserDto.phoneNumber;
    if (rawPhone !== undefined) {
      updatePayload.phoneNumber = String(rawPhone).trim();
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

    if (updateUserDto.location !== undefined) {
      updatePayload.location = {
        type: 'Point',
        coordinates: [updateUserDto.location.lng, updateUserDto.location.lat],
        updatedAt: new Date(),
      };
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

  async checkIn(
    userId: string | mongoose.Types.ObjectId,
    targetUserId?: string,
  ) {
    const idToUpdate = targetUserId || userId;
    const user = await this.userModel.findByIdAndUpdate(
      idToUpdate,
      { $set: { checkedIn: true } },
      { new: true },
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return {
      message: 'Checked in successfully',
      data: this.toResponse(user),
    };
  }

  async checkOut(
    userId: string | mongoose.Types.ObjectId,
    targetUserId?: string,
  ) {
    const idToUpdate = targetUserId || userId;
    const user = await this.userModel.findByIdAndUpdate(
      idToUpdate,
      { $set: { checkedIn: false } },
      { new: true },
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return {
      message: 'Checked out successfully',
      data: this.toResponse(user),
    };
  }

  private toResponse(user: UserDocument): UserResponse {
    const plainUser = user.toObject() as UserPlainObject & {
      checkedIn?: boolean;
    };

    return {
      _id: plainUser._id.toString(),
      name: plainUser.name,
      email: plainUser.email,
      role: plainUser.role,
      phoneNumber: plainUser.phoneNumber,
      location: plainUser.location,
      checkedIn: plainUser.checkedIn ?? true,
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

  async forgetPassword(dto: PasswordResetRequestDto) {
    const user = await this.findByEmail(dto.email);
    if (user) {
      const secret = this.configService.getOrThrow<string>('JWT_SECRET');
      const resetToken = await this.jwtService.signAsync(
        { userId: user._id },
        { expiresIn: '1d', secret },
      );

      // Send real transactional password reset email via ZeptoMail
      await this.mailService.sendPasswordResetEmail(
        user.email,
        user.name,
        resetToken,
      );
    }
    return {
      message:
        'If an account with that email exists, a password reset link has been sent.',
      data: null,
    };
  }

  async resetPassword(token: string, dto: ResetPasswordDto) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }
    const secret = this.configService.getOrThrow<string>('JWT_SECRET');
    const decodedToken = await this.jwtService.verifyAsync(token, { secret });
    const user = await this.userModel.findById(decodedToken.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    await user.save();
    return {
      message: 'Password reset successfully',
      data: null,
    };
  }

  async changePassword(
    userId: mongoose.Types.ObjectId,
    dto: ChangePasswordDto,
  ) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }
    const user = await this.userModel.findById(userId).select('+passwordHash');
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const isPasswordMatch = await bcrypt.compare(
      dto.oldPassword,
      user.passwordHash,
    );
    if (!isPasswordMatch) {
      throw new BadRequestException('Invalid old password');
    }
    user.passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    await user.save();
    return {
      message: 'Password changed successfully',
      data: null,
    };
  }
}
