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

export enum SalesmanWorkflowStatus {
  NotStarted = 'not_started',
  Travelling = 'travelling',
  Measuring = 'measuring',
  Completed = 'completed',
}

@Schema()
export class QuotationItem {
  @Prop({ required: false })
  id: string;

  @Prop({ required: false })
  description: string;

  @Prop({ required: false })
  quantity: number;

  @Prop({ required: false })
  unitPrice: number;

  @Prop({ required: false })
  total: number;
}

@Schema()
export class Quotation {
  @Prop({ required: false })
  id: string;

  @Prop({ required: false })
  client: string;

  @Prop()
  salesmanId?: string;

  @Prop()
  salesmanName?: string;

  @Prop()
  clientPhone?: string;

  @Prop()
  clientEmail?: string;

  @Prop()
  notes?: string;

  @Prop({ required: true })
  total: number;

  @Prop({ required: true, default: 'Draft' })
  status: string;

  @Prop()
  date: string;

  @Prop()
  sentDate?: string;

  @Prop({ type: [QuotationItem], default: [] })
  items: QuotationItem[];
}

@Schema({ _id: false })
export class GeoLocation {
  @Prop({
    type: String,
    enum: ['Point'],
    default: 'Point',
  })
  type: string;

  @Prop({
    type: [Number],
    required: true,
    default: [0, 0],
  })
  coordinates: number[];
}

@Schema({ timestamps: true, versionKey: false })
export class Job {
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 60 })
  firstName: string;

  @Prop({ required: true, trim: true, minlength: 2, maxlength: 60 })
  lastName: string;

  @Prop({ required: false, lowercase: true, trim: true })
  customerEmail?: string;

  @Prop({ required: false, trim: true })
  customerPhone: string;

  @Prop({ required: true, trim: true, maxlength: 250 })
  address: string;

  @Prop({ type: GeoLocation, required: false })
  location?: GeoLocation;

  @Prop({ required: false, trim: true, maxlength: 80 })
  productType?: string;

  @Prop({ required: false, trim: true, maxlength: 80 })
  propertyType?: string;

  @Prop({ required: false, min: 1 })
  quantity?: number;

  @Prop({ required: false, min: 0 })
  projectValue?: number;

  @Prop({ required: true, enum: JobStatus, default: JobStatus.Pending })
  status: JobStatus;

  @Prop({ required: true, enum: JobPriority, default: JobPriority.Medium })
  priority: JobPriority;

  @Prop({ trim: true, maxlength: 1000 })
  notes?: string;

  @Prop()
  scheduledAt?: Date;

  @Prop({ required: false, trim: true })
  assignedTo?: string;

  @Prop({ required: false, trim: true })
  assignedBy?: string;

  @Prop({ required: false, trim: true })
  assignedSalesman?: string;

  @Prop({
    required: false,
    enum: SalesmanWorkflowStatus,
    default: SalesmanWorkflowStatus.NotStarted,
    index: true,
  })
  salesmanWorkflowStatus?: SalesmanWorkflowStatus;

  @Prop({ required: false, trim: true })
  activeSalesmanId?: string;

  @Prop({ required: false, trim: true })
  activeSalesmanName?: string;

  @Prop()
  travelStartedAt?: Date;

  @Prop()
  measurementStartedAt?: Date;

  @Prop()
  measurementCompletedAt?: Date;

  @Prop({ required: false, trim: true })
  assignedFitter?: string;

  @Prop({ type: Quotation })
  quotation?: Quotation;

  @Prop()
  timerStartedAt?: Date;
}

export const JobSchema = SchemaFactory.createForClass(Job);

JobSchema.virtual('customerName').get(function () {
  return `${this.firstName || ''} ${this.lastName || ''}`.trim();
});

JobSchema.set('toJSON', { virtuals: true });
JobSchema.set('toObject', { virtuals: true });

JobSchema.index({ customerEmail: 1 });
JobSchema.index({ status: 1, scheduledAt: 1 });
JobSchema.index({ assignedSalesman: 1, salesmanWorkflowStatus: 1 });
JobSchema.index({ createdAt: -1 });
JobSchema.index({ location: '2dsphere' });
