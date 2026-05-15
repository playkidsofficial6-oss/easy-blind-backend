import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Fitter, FitterDocument } from './schemas/fitter.schema';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';

@Injectable()
export class FittersService {
  constructor(
    @InjectModel(Fitter.name) private fitterModel: Model<FitterDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async findAll(): Promise<Fitter[]> {
    const fitterUsers = await this.userModel.find({ role: UserRole.Fitter }).exec();

    for (const user of fitterUsers) {
      const existing = await this.fitterModel.findOne({ user: user._id }).exec();
      if (!existing) {
        await this.fitterModel.create({
          user: user._id,
          status: 'available',
          capacity: user.maxDailyJobs || 5,
          location: user.location,
          phone: user.phone,
        });
      }
    }

    return this.fitterModel.find().populate('user').exec();
  }
}
