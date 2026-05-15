import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User, UserLocation, UserLocationSchema } from '../../users/schemas/user.schema';

export type FitterProfileStatus = 'available' | 'on_the_way' | 'in_progress' | 'fully_booked';

@Schema({ timestamps: true, versionKey: false })
export class Fitter {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  user: User | Types.ObjectId;

  @Prop({ type: String, enum: ['available', 'on_the_way', 'in_progress', 'fully_booked'], default: 'available' })
  status: FitterProfileStatus;

  @Prop({ type: Number, default: 5 })
  capacity: number;

  @Prop({ type: [String], default: [] })
  skills: string[];

  @Prop({ trim: true, maxlength: 30 })
  phone?: string;

  @Prop({ type: UserLocationSchema })
  location?: UserLocation;

  @Prop({ trim: true, maxlength: 500 })
  notes?: string;
}

export type FitterDocument = HydratedDocument<Fitter>;
export const FitterSchema = SchemaFactory.createForClass(Fitter);
