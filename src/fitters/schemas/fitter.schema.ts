import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export enum FitterProfileStatus {
  Available = 'available',
  OnTheWay = 'on_the_way',
  InProgress = 'in_progress',
  FullyBooked = 'fully_booked',
}

@Schema({ _id: false, versionKey: false })
export class FitterLocation {
  @Prop({ required: true, type: Number })
  lat: number;

  @Prop({ required: true, type: Number })
  lng: number;

  @Prop({ required: true, trim: true, maxlength: 255 })
  address: string;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export const FitterLocationSchema =
  SchemaFactory.createForClass(FitterLocation);

@Schema({ timestamps: true, versionKey: false })
export class Fitter {
  @Prop({
    type: Types.ObjectId,
    ref: User.name,
    required: true,
    unique: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({ trim: true, maxlength: 30 })
  phone?: string;

  @Prop({ type: FitterLocationSchema })
  location?: FitterLocation;

  @Prop({
    enum: FitterProfileStatus,
    default: FitterProfileStatus.Available,
    index: true,
  })
  status: FitterProfileStatus;

  @Prop({ type: Number, min: 1, max: 20, default: 5 })
  capacity: number;

  @Prop({ type: [String], default: [] })
  skills: string[];

  @Prop({ trim: true, maxlength: 1000 })
  notes?: string;
}

export type FitterDocument = HydratedDocument<Fitter>;
export const FitterSchema = SchemaFactory.createForClass(Fitter);

FitterSchema.index({ userId: 1 }, { unique: true });
