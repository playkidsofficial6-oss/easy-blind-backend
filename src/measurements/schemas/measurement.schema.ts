import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type MeasurementDocument = HydratedDocument<Measurement>;

export enum MeasurementStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum OpeningType {
  WINDOW = 'WINDOW',
  DOOR = 'DOOR',
  CUSTOM = 'CUSTOM',
}

@Schema({ _id: false })
export class Opening {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true, enum: OpeningType })
  type: OpeningType;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, min: 0 })
  width: number;

  @Prop({ required: true, min: 0 })
  height: number;

  @Prop({ required: true, default: 'cm' })
  measurementUnit: string;

  @Prop({ required: true })
  mountType: string;

  @Prop({ required: true })
  openingDirection: string;

  @Prop({ required: true })
  productType: string;

  @Prop({ required: true })
  materialType: string;

  @Prop({ required: false })
  customMaterial?: string;

  @Prop({ required: true })
  motorType: string;

  @Prop({ required: false })
  notes?: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  metadata: Record<string, any>;

  @Prop({ required: true, default: 0 })
  area: number;
}

export const OpeningSchema = SchemaFactory.createForClass(Opening);

@Schema({ _id: false })
export class Room {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  category: string; // e.g. Living Room, Bedroom

  @Prop({ type: [OpeningSchema], default: [] })
  openings: Opening[];
}

export const RoomSchema = SchemaFactory.createForClass(Room);

@Schema({ timestamps: true, versionKey: false })
export class Measurement {
  @Prop({ required: true, index: true })
  jobId: string;

  @Prop({ required: true, index: true })
  assignedStaff: string;

  @Prop({ required: true })
  visitDate: Date;

  @Prop({ required: true, enum: MeasurementStatus, default: MeasurementStatus.PENDING, index: true })
  status: MeasurementStatus;

  @Prop({ type: [RoomSchema], default: [] })
  rooms: Room[];

  @Prop({ required: true, default: 0 })
  totalRooms: number;

  @Prop({ required: true, default: 0 })
  totalOpenings: number;

  @Prop({ required: true, default: 0 })
  totalWindows: number;

  @Prop({ required: true, default: 0 })
  totalDoors: number;
}

export const MeasurementSchema = SchemaFactory.createForClass(Measurement);

MeasurementSchema.index({ createdAt: -1 });
