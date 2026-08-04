import { Injectable } from '@nestjs/common';
import { AuthUser } from 'src/helpers/AuthUser.type';
import { TrackLiveLocationDto } from './dto/trackLiveLocation.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from 'src/users/schemas/user.schema';
import { Model } from 'mongoose';

@Injectable()
export class LiveLocationService {
    constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>,) { }
    async trackLiveLocation(AuthUser: AuthUser, dto: TrackLiveLocationDto) {
        await this.userModel.findByIdAndUpdate(
            AuthUser.userId,
            {
                location: {
                    type: 'Point',
                    coordinates: [dto.longitude, dto.latitude],
                },
                updatedAt: new Date(),
            },
            {
                new: true,
                runValidators: true,
            }
        )

        return {
            message: "location tracked successfully",
            data: null
        }
    }
}
