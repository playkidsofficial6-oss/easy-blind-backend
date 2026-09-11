import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false, versionKey: false })
export class UserLocation {
  @Prop({
    type: String,
    enum: ['Point'],
    default: 'Point',
    required: true,
  })
  type: 'Point';

  /**
   * [longitude, latitude] — GeoJSON order.
   */
  @Prop({ type: [Number], required: true })
  coordinates: [number, number];

  @Prop({ type: Date })
  updatedAt?: Date;
}

export const UserLocationSchema = SchemaFactory.createForClass(UserLocation);

export enum UserRole {
  Admin = 'Admin',
  Owner = 'Owner',
  SalesManager = 'Sales Manager',
  Salesman = 'Salesman',
  Field = 'Field',
  Fitter = 'Fitter',
  Stitching = 'Stitching',
  User = 'User',
}

@Schema({ timestamps: true, versionKey: false })
export class User {
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 100 })
  name: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  })
  email: string;

  @Prop({
    required: false,
    trim: true,
    index: true,
    validate: {
      validator: function (v: string) {
        return /^\+\d{7,15}$/.test(v);
      },
      message: 'Phone number must include country code (e.g. +91, +957)',
    },
  })
  phoneNumber?: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ enum: UserRole, default: UserRole.User, index: true })
  role: UserRole;

  @Prop({ type: UserLocationSchema })
  location?: UserLocation;

  @Prop({ type: Boolean, default: false, index: true })
  checkedIn?: boolean;

  /** Hashed refresh token — never returned in queries by default. */
  @Prop({ select: false })
  refreshToken?: string;

  @Prop({ type: Boolean, default: false, index: true })
  isDeleted?: boolean;

  @Prop({ type: [String], default: [] })
  fcmTokens?: string[];

  @Prop({ type: Date })
  lastSeenStaffRequestsAt?: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

// 2dsphere index enables geospatial queries (sparse = only index docs that have location set)
UserSchema.index({ location: '2dsphere' }, { sparse: true });
