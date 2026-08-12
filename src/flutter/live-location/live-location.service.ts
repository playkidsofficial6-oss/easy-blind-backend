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

        const updatedUser = await this.userModel.findByIdAndUpdate(
            AuthUser.userId,
            {
                location: {
                    type: 'Point',
                    coordinates: [longitude, latitude],
                },
                updatedAt: new Date(),
            },
            {
                returnDocument: 'after',
                runValidators: true,
            }
        );

        const userIdStr = updatedUser?._id?.toString() || AuthUser.userId;
        const locationRecord = {
            userId: userIdStr,
            _id: userIdStr,
            role: updatedUser?.role || AuthUser.role,
            location: updatedUser?.location || {
                type: 'Point',
                coordinates: [longitude, latitude],
            },
            lat: latitude,
            lng: longitude,
            latitude,
            longitude,
            updatedAt: (updatedUser as any)?.updatedAt || new Date(),
            createdAt: (updatedUser as any)?.createdAt,
        };

        return {
            message: "location tracked successfully",
            data: locationRecord
        };
    }
}
