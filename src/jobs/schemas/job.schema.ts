import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type JobDocument = HydratedDocument<Job>;

export enum JobStatus {
  Pending = 'pending',
  Scheduled = 'scheduled',
  InProgress = 'in_progress',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export enum JobPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

@Schema({ timestamps: true, versionKey: false })
export class Job {
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 120 })
  customerName: string;

  @Prop({ required: true, lowercase: true, trim: true })
  customerEmail: string;

  @Prop({ required: true, trim: true })
  customerPhone: string;

  @Prop({ required: true, trim: true, maxlength: 250 })
  address: string;

  @Prop({ required: true, trim: true, maxlength: 80 })
  productType: string;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true, enum: JobStatus, default: JobStatus.Pending })
  status: JobStatus;

  @Prop({ required: true, enum: JobPriority, default: JobPriority.Medium })
  priority: JobPriority;

  @Prop({ trim: true, maxlength: 1000 })
  notes?: string;

  @Prop()
  scheduledAt?: Date;
}

export const JobSchema = SchemaFactory.createForClass(Job);

JobSchema.index({ customerEmail: 1 });
JobSchema.index({ status: 1, scheduledAt: 1 });
JobSchema.index({ createdAt: -1 });
