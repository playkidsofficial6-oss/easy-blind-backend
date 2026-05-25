import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtAuthenticatedUser } from '../auth/interfaces/jwt-user.interface';
import { UserRole } from '../users/schemas/user.schema';
import { UpdateLiveLocationDto } from './dto/update-live-location.dto';
import {
  LiveLocation,
  LiveLocationDocument,
  LiveLocationRole,
} from './schemas/live-location.schema';

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

type LiveLocationPlainObject = LiveLocation & {
  _id: { toString(): string };
  userId: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

type LiveLocationUpdatePayload = Pick<
  LiveLocation,
  'userId' | 'role' | 'location' | 'lastUpdatedAt'
> &
  Partial<Pick<LiveLocation, 'accuracy' | 'speed' | 'heading' | 'isOnline'>>;

@Injectable()
export class LiveLocationService {
  constructor(
    @InjectModel(LiveLocation.name)
    private readonly liveLocationModel: Model<LiveLocationDocument>,
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

    const userObjectId = new Types.ObjectId(authUser.userId);
    const isOnline = updateLiveLocationDto.isOnline ?? true;
    const payload: any = {
      userId: userObjectId,
      role: trackingRole,

      location: {
        type: 'Point',
        coordinates: updateLiveLocationDto.location.coordinates,
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

    const updatedLocation = await this.liveLocationModel
      .findOneAndUpdate(
        { userId: userObjectId },
        { $set: payload },
        {
          returnDocument: 'after',
          runValidators: true,
          upsert: true,
          setDefaultsOnInsert: true,
        },
      )
      .exec();

    return this.success(
      'Live location updated successfully',
      this.toResponse(updatedLocation),
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

    const userObjectId = new Types.ObjectId(authUser.userId);
    const updatedLocation = await this.liveLocationModel
      .findOneAndUpdate(
        { userId: userObjectId },
        {
          $set: {
            role: trackingRole,
            isOnline,
            liveStatus: isOnline ? 'Available' : 'Offline',
            lastUpdatedAt: new Date(),
          },
        },
        {
          returnDocument: 'after',
          runValidators: true,
        },
      )
      .exec();

    return updatedLocation ? this.toResponse(updatedLocation) : null;
  }

  async findAll(
    authUser: JwtAuthenticatedUser,
  ): Promise<ApiResponse<LiveLocationResponse[]>> {
    this.assertCanAccessAll(authUser);

    const locations = await this.liveLocationModel
      .find()
      .sort({ lastUpdatedAt: -1 })
      .exec();

    return this.success(
      'Live locations returned successfully',
      locations.map((location) => this.toResponse(location)),
    );
  }

  async findByUserId(
    authUser: JwtAuthenticatedUser,
    userId: string,
  ): Promise<ApiResponse<LiveLocationResponse>> {
    this.assertCanAccessUserLocation(authUser, userId);

    const location = await this.liveLocationModel.findOne({ userId }).exec();

    if (!location) {
      throw new NotFoundException('Live location not found for this user');
    }

    return this.success(
      'Live location returned successfully',
      this.toResponse(location),
    );
  }

  async deleteByUserId(
    authUser: JwtAuthenticatedUser,
    userId: string,
  ): Promise<ApiResponse<LiveLocationResponse>> {
    this.assertCanAccessAll(authUser);

    const deletedLocation = await this.liveLocationModel
      .findOneAndDelete({ userId })
      .exec();

    if (!deletedLocation) {
      throw new NotFoundException('Live location not found for this user');
    }

    return this.success(
      'Live location deleted successfully',
      this.toResponse(deletedLocation),
    );
  }

  private assertCanAccessAll(authUser: JwtAuthenticatedUser): void {
    if (![UserRole.Owner, UserRole.SalesManager, UserRole.Admin].includes(authUser.role)) {
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

  private toResponse(location: LiveLocationDocument): LiveLocationResponse {
    const plainLocation = location.toObject() as LiveLocationPlainObject;

    return {
      _id: plainLocation._id?.toString(),
      userId: plainLocation.userId?.toString(),
      role: plainLocation.role,
      liveStatus: (plainLocation as any).liveStatus,
      location: plainLocation.location,
      accuracy: plainLocation.accuracy,
      speed: plainLocation.speed,
      heading: plainLocation.heading,
      isOnline: plainLocation.isOnline,
      lastUpdatedAt: plainLocation.lastUpdatedAt,
      createdAt: plainLocation.createdAt,
      updatedAt: plainLocation.updatedAt,
    };
  }

  async updateLiveStatus(
    userId: string,
    liveStatus: string,
  ): Promise<void> {
    await this.liveLocationModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { $set: { liveStatus, lastUpdatedAt: new Date() } },
      )
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
