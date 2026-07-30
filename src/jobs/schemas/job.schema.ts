import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type JobDocument = HydratedDocument<Job>;

export enum JobStatus {
  Pending = 'Pending',
  SalesmanScheduled = 'Salesman Scheduled',
  SalesmanOnTheWay = 'Salesman On The Way',
  SalesmanReached = 'Salesman Reached',
  SalesmanCancelled = 'Salesman Cancelled',
  Measuring = 'Measuring',
  Quoting = 'Quoting',
  ReadyForFitting = 'Ready for Fitting',
  FitterAssigned = 'Fitter Assigned',
  FitterOnTheWay = 'Fitter On The Way',
  FitterReached = 'Fitter Reached',
  FitterCancelled = 'Fitter Cancelled',
  Fitting = 'Fitting',
  TakingPhotos = 'Taking Photos',
  Completed = 'Completed',
  Cancelled = 'Cancelled',
  Dropped = 'Dropped',
}

export enum JobPriority {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
}





export enum OpeningType {
  WINDOW = 'Window',
  DOOR = 'Door',
  CUSTOM = 'Custom',
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
  category: string;

  @Prop({ type: [OpeningSchema], default: [] })
  openings: Opening[];
}

export const RoomSchema = SchemaFactory.createForClass(Room);

@Schema({ _id: false })
export class JobMeasurements {
  @Prop({ required: false })
  visitDate?: Date;

  @Prop({ required: false, default: 'Completed' })
  status?: string;

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

export const JobMeasurementsSchema =
  SchemaFactory.createForClass(JobMeasurements);

@Schema({ _id: false })
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

@Schema({ _id: false })
export class Quotation {
  @Prop({ required: false })
  id: string;

  @Prop({ required: false })
  client: string;

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
  @Prop({
    required: false,
    immutable: true,
    trim: true,
    match: /^JOB-\d{4}-\d{4}$/,
  })
  jobId?: string;

  @Prop({ required: true, trim: true, minlength: 2, maxlength: 60 })
  firstName: string;

  @Prop({ required: false, trim: true, maxlength: 60 })
  lastName: string;

  @Prop({ required: false, lowercase: true, trim: true })
  customerEmail?: string;

  @Prop({ required: false, trim: true })
  customerPhone: string;

  @Prop({ required: false, trim: true })
  customerNote?: string;

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

  @Prop({
    required: false,
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
  })
  assignedSalesManager?: Types.ObjectId;

  @Prop({
    required: false,
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
  })
  assignedSalesman?: Types.ObjectId;

  @Prop()
  travelStartedAt?: Date;

  @Prop()
  measurementStartedAt?: Date;

  @Prop()
  measurementCompletedAt?: Date;

  @Prop({
    required: false,
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
  })
  assignedFitter?: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  fittingPhotos?: string[];

  @Prop({ trim: true, maxlength: 2000 })
  fittingNotes?: string;

  @Prop()
  fitterTravelStartedAt?: Date;

  @Prop()
  fittingStartedAt?: Date;

  @Prop()
  fittingCompletedAt?: Date;

  @Prop({ type: Quotation })
  quotation?: Quotation;

  @Prop({ type: Object, required: false })
  rescheduleRequest?: {
    status: 'pending' | 'resolved';
    requestedAt: Date;
  };

  @Prop({ type: String, required: false })
  cancelReason?: string;

  @Prop()
  timerStartedAt?: Date;

  @Prop({ type: JobMeasurementsSchema, required: false })
  measurements?: JobMeasurements;
}

export const JobSchema = SchemaFactory.createForClass(Job);

JobSchema.virtual('customerName').get(function () {
  return `${this.firstName || ''} ${this.lastName || ''}`.trim();
});

JobSchema.set('toJSON', { virtuals: true });
JobSchema.set('toObject', { virtuals: true });

JobSchema.index({ jobId: 1 }, { unique: true, sparse: true });
JobSchema.index({ customerEmail: 1 });
JobSchema.index({ status: 1, scheduledAt: 1 });
JobSchema.index({ assignedSalesManager: 1 });
JobSchema.index({ assignedSalesman: 1 });
JobSchema.index({ assignedFitter: 1 });
JobSchema.index({ createdAt: -1 });
JobSchema.index({ location: '2dsphere' });
