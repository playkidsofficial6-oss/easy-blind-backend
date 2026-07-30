import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserStatus =
  | 'Available'
  | 'On the way'
  | 'In progress'
  | 'Completed'
  | 'Offline'
  | 'Fully Booked';

/**
 * Native GeoJSON Point sub-document.
 * coordinates = [longitude, latitude] — GeoJSON standard order.
 */
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

  @Prop({ trim: true, maxlength: 255 })
  address?: string;

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

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ enum: UserRole, default: UserRole.User, index: true })
  role: UserRole;

  @Prop({
    enum: [
      'Available',
      'On the way',
      'In progress',
      'Completed',
      'Offline',
      'Fully Booked',
    ],
  })
  status?: UserStatus;

  @Prop({ type: UserLocationSchema })
  location?: UserLocation;

  @Prop({ type: Boolean, default: true, index: true })
  isOnline?: boolean;

  @Prop({ type: Boolean, default: true, index: true })
  checkedIn?: boolean;

  @Prop({ type: Date })
  lastUpdatedAt?: Date;

  @Prop({ type: Number, min: 0 })
  accuracy?: number;

  @Prop({ type: Number, min: 0 })
  speed?: number;

  @Prop({ type: Number, min: 0, max: 360 })
  heading?: number;

  /** Hashed refresh token — never returned in queries by default. */
  @Prop({ select: false })
  refreshToken?: string;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

// 2dsphere index enables geospatial queries (sparse = only index docs that have location set)
UserSchema.index({ location: '2dsphere' }, { sparse: true });
