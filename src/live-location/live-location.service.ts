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
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
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

    const payload: Partial<User> = {
      location: {
        type: 'Point',
        coordinates: updateLiveLocationDto.location.coordinates,
        updatedAt: new Date(),
      },
    };

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
            checkedIn: isOnline,
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
      .sort({ updatedAt: -1 })
      .exec();

    return this.success(
      'Live locations returned successfully',
      users.map((user) => this.toResponse(user)),
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
      location: plainUser.location ?? {
        type: 'Point',
        coordinates: [0, 0],
      },
      createdAt: plainUser.createdAt,
      updatedAt: plainUser.updatedAt,
    };
  }

  async updateLiveStatus(userId: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, {
        $set: { checkedIn: true },
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
