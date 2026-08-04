import { Injectable } from '@nestjs/common';
import { AuthUser } from '../../helpers/AuthUser.type';
import { TrackLiveLocationDto } from './dto/trackLiveLocation.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { Model } from 'mongoose';

@Injectable()
export class LiveLocationService {
    constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>,) { }
    async trackLiveLocation(AuthUser: AuthUser, dto: TrackLiveLocationDto) {
        let payloadDto: any = dto;
        if (typeof dto === 'string') {
            try {
                payloadDto = JSON.parse(dto);
            } catch {
                payloadDto = dto;
            }
        }

        const latitude = Number(payloadDto?.latitude);
        const longitude = Number(payloadDto?.longitude);

        await this.userModel.findByIdAndUpdate(
            AuthUser.userId,
            {
                location: {
                    type: 'Point',
                    coordinates: [longitude, latitude],
                },
                updatedAt: new Date(),
            },
            {
                new: true,
                runValidators: true,
            }
        );

        return {
            message: "location tracked successfully",
            data: null
        };
    }
}
