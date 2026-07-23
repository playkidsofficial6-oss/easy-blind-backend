import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtAuthenticatedUser } from '../auth/interfaces/jwt-user.interface';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { UpdateLiveLocationDto } from './dto/update-live-location.dto';

export enum LiveLocationRole {
  Salesman = 'SALESMAN',
  Fitter = 'FITTER',
}

export interface ApiResponse<T> {
  success: true;
  message: string;
  data: T;
}

export interface LiveLocationResponse {
  _id: string;
  userId: string;
  role: LiveLocationRole;
  liveStatus?: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  accuracy?: number;
  speed?: number;
  heading?: number;
  isOnline: boolean;
  lastUpdatedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

type UserPlainObject = User & {
  _id: { toString(): string };
  createdAt?: Date;
  updatedAt?: Date;
};

@Injectable()
export class LiveLocationService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async updateLocation(
    authUser: JwtAuthenticatedUser,
    updateLiveLocationDto: UpdateLiveLocationDto,
  ): Promise<ApiResponse<LiveLocationResponse>> {
    const trackingRole = this.toTrackingRole(authUser.role);

    if (!trackingRole) {
      throw new ForbiddenException(
        'Only salesman and fitter users can update live location',
      );
    }

    const isOnline = updateLiveLocationDto.isOnline ?? true;
    const payload: Partial<User> = {
      location: {
        type: 'Point',
        coordinates: updateLiveLocationDto.location.coordinates,
        updatedAt: new Date(),
      },
      accuracy: updateLiveLocationDto.accuracy,
      speed: updateLiveLocationDto.speed,
      heading: updateLiveLocationDto.heading,
      isOnline,
      lastUpdatedAt: new Date(),
    };

    if (!isOnline) {
      payload.liveStatus = 'Offline';
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(authUser.userId, { $set: payload }, { new: true })
      .exec();

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return this.success(
      'Live location updated successfully',
      this.toResponse(updatedUser),
    );
  }

  async setOnlineStatus(
    authUser: JwtAuthenticatedUser,
    isOnline: boolean,
  ): Promise<LiveLocationResponse | null> {
    const trackingRole = this.toTrackingRole(authUser.role);

    if (!trackingRole) {
      throw new ForbiddenException(
        'Only salesman and fitter users can update live location status',
      );
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        authUser.userId,
        {
          $set: {
            isOnline,
            liveStatus: isOnline ? 'Available' : 'Offline',
            lastUpdatedAt: new Date(),
          },
        },
        { new: true },
      )
      .exec();

    return updatedUser ? this.toResponse(updatedUser) : null;
  }

  async findAll(
    authUser: JwtAuthenticatedUser,
  ): Promise<ApiResponse<LiveLocationResponse[]>> {
    this.assertCanAccessAll(authUser);

    const users = await this.userModel
      .find({
        role: { $in: [UserRole.Salesman, UserRole.Field, UserRole.Fitter] },
        location: { $exists: true },
      })
      .sort({ lastUpdatedAt: -1 })
      .exec();

    return this.success(
      'Live locations returned successfully',
      users.map((user) => this.toResponse(user)),
    );
  }

  async findByUserId(
    authUser: JwtAuthenticatedUser,
    userId: string,
  ): Promise<ApiResponse<LiveLocationResponse>> {
    this.assertCanAccessUserLocation(authUser, userId);

    const user = await this.userModel.findById(userId).exec();

    if (!user) {
      throw new NotFoundException('Live location not found for this user');
    }

    return this.success(
      'Live location returned successfully',
      this.toResponse(user),
    );
  }

  async deleteByUserId(
    authUser: JwtAuthenticatedUser,
    userId: string,
  ): Promise<ApiResponse<LiveLocationResponse>> {
    this.assertCanAccessAll(authUser);

    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          $unset: {
            location: 1,
            accuracy: 1,
            speed: 1,
            heading: 1,
            lastUpdatedAt: 1,
          },
          $set: { isOnline: false, liveStatus: 'Offline' },
        },
        { new: true },
      )
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.success(
      'Live location deleted successfully',
      this.toResponse(user),
    );
  }

  private assertCanAccessAll(authUser: JwtAuthenticatedUser): void {
    if (
      ![UserRole.Owner, UserRole.SalesManager, UserRole.Admin].includes(
        authUser.role,
      )
    ) {
      throw new ForbiddenException(
        'Only owner, sales manager, and admin users can access all live locations',
      );
    }
  }

  private assertCanAccessUserLocation(
    authUser: JwtAuthenticatedUser,
    userId: string,
  ): void {
    if (this.canAccessAll(authUser.role)) {
      return;
    }

    if (authUser.userId !== userId) {
      throw new ForbiddenException(
        'You can only access your own live location',
      );
    }
  }

  private canAccessAll(role: UserRole): boolean {
    return [UserRole.Owner, UserRole.SalesManager].includes(role);
  }

  private toTrackingRole(role: UserRole): LiveLocationRole | null {
    if (role === UserRole.Salesman || role === UserRole.Field) {
      return LiveLocationRole.Salesman;
    }

    if (role === UserRole.Fitter) {
      return LiveLocationRole.Fitter;
    }

    return null;
  }

  private toResponse(user: UserDocument): LiveLocationResponse {
    const plainUser = user.toObject() as UserPlainObject;
    const userIdStr = plainUser._id.toString();

    return {
      _id: userIdStr,
      userId: userIdStr,
      role: this.toTrackingRole(plainUser.role) ?? LiveLocationRole.Salesman,
      liveStatus: plainUser.liveStatus,
      location: plainUser.location ?? {
        type: 'Point',
        coordinates: [0, 0],
      },
      accuracy: plainUser.accuracy,
      speed: plainUser.speed,
      heading: plainUser.heading,
      isOnline: plainUser.isOnline ?? true,
      lastUpdatedAt: plainUser.lastUpdatedAt ?? plainUser.updatedAt ?? new Date(),
      createdAt: plainUser.createdAt,
      updatedAt: plainUser.updatedAt,
    };
  }

  async updateLiveStatus(userId: string, liveStatus: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, {
        $set: { liveStatus, lastUpdatedAt: new Date() },
      })
      .exec();
  }

  private success<T>(message: string, data: T): ApiResponse<T> {
    return {
      success: true,
      message,
      data,
    };
  }
}
