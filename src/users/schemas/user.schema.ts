import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LiveUserStatus =
  | 'Available'
  | 'On the way'
  | 'In progress'
  | 'Completed'
  | 'Offline'
  | 'Fully Booked';

@Schema({ _id: false, versionKey: false })
export class UserLocation {
  @Prop({ required: true, type: Number })
  lat: number;

  @Prop({ required: true, type: Number })
  lng: number;

  @Prop({ trim: true, maxlength: 255 })
  address?: string;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export const UserLocationSchema = SchemaFactory.createForClass(UserLocation);

export enum UserRole {
  Admin = 'admin',
  Owner = 'owner',
  SalesManager = 'sales_manager',
  Salesman = 'salesman',
  Field = 'field',
  Fitter = 'fitter',
  Stitching = 'stitching',
  User = 'user',
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

  @Prop({ trim: true, maxlength: 30 })
  phone?: string;

  @Prop({ trim: true, maxlength: 500 })
  avatar?: string;

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
  liveStatus?: LiveUserStatus;

  @Prop({ type: UserLocationSchema })
  location?: UserLocation;

  @Prop({ type: Number, min: 1, max: 20, default: 5 })
  maxDailyJobs?: number;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ email: 1 }, { unique: true });
