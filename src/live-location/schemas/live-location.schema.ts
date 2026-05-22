import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export enum LiveLocationRole {
  Salesman = 'SALESMAN',
  Fitter = 'FITTER',
}

@Schema({ timestamps: true, versionKey: false })
export class LiveLocation {
  @Prop({
    type: Types.ObjectId,
    ref: User.name,
    required: true,
    unique: true,
  })
  userId: Types.ObjectId;

  @Prop({ enum: LiveLocationRole, required: true, index: true })
  role: LiveLocationRole;



  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  })
  location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };

  @Prop({ type: Number, min: 0 })
  accuracy?: number;

  @Prop({ type: Number, min: 0 })
  speed?: number;

  @Prop({ type: Number, min: 0, max: 360 })
  heading?: number;

  @Prop({ type: Boolean, default: true, index: true })
  isOnline: boolean;

  @Prop({ type: Date, required: true, default: Date.now, index: true })
  lastUpdatedAt: Date;

  createdAt?: Date;

  updatedAt?: Date;
}

export type LiveLocationDocument = HydratedDocument<LiveLocation>;
export const LiveLocationSchema = SchemaFactory.createForClass(LiveLocation);

LiveLocationSchema.index({ role: 1, isOnline: 1, lastUpdatedAt: -1 });
LiveLocationSchema.index({ lastUpdatedAt: -1 });
LiveLocationSchema.index({ location: '2dsphere' });
