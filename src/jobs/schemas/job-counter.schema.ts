import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type JobCounterDocument = HydratedDocument<JobCounter>;

@Schema({ timestamps: true, versionKey: false })
export class JobCounter {
  @Prop({ required: true, unique: true, trim: true })
  key: string;

  @Prop({ required: true, min: 0, default: 0 })
  sequence: number;
}

export const JobCounterSchema = SchemaFactory.createForClass(JobCounter);

JobCounterSchema.index({ key: 1 }, { unique: true });
