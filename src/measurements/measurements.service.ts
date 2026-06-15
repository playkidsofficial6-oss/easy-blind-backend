import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Measurement, MeasurementDocument } from './schemas/measurement.schema';
import { CreateMeasurementDto } from './dtos/create-measurement.dto';
import { UpdateMeasurementDto } from './dtos/update-measurement.dto';
import { RoomDto, OpeningDto } from './dtos/create-measurement.dto';

@Injectable()
export class MeasurementsService {
  constructor(
    @InjectModel(Measurement.name)
    private readonly measurementModel: Model<MeasurementDocument>,
  ) {}

  private processMeasurementData(
    dto: Partial<CreateMeasurementDto | UpdateMeasurementDto>,
  ) {
    if (!dto.rooms) return {};

    const {
      processedRooms,
      totalRooms,
      totalOpenings,
      totalWindows,
      totalDoors,
    } = this.calculateSummaryAndArea(dto.rooms);

    return {
      rooms: processedRooms,
      totalRooms,
      totalOpenings,
      totalWindows,
      totalDoors,
    };
  }

  private calculateSummaryAndArea(rooms: RoomDto[]) {
    const totalRooms = rooms.length;
    let totalOpenings = 0;
    let totalWindows = 0;
    let totalDoors = 0;

    const processedRooms = rooms.map((room) => {
      const openings = (room.openings || []).map((opening: OpeningDto) => {
        totalOpenings++;

        // Handle case-insensitive type matches
        const upperType = (opening.type || '').toUpperCase();
        if (upperType === 'WINDOW') totalWindows++;
        if (upperType === 'DOOR') totalDoors++;

        const area = (opening.width || 0) * (opening.height || 0);

        return {
          ...opening,
          type: upperType || 'WINDOW',
          area,
          images: opening.images || [],
          metadata: opening.metadata || {},
        };
      });

      return {
        ...room,
        openings,
      };
    });

    return {
      processedRooms,
      totalRooms,
      totalOpenings,
      totalWindows,
      totalDoors,
    };
  }

  async createMeasurement(
    createDto: CreateMeasurementDto,
  ): Promise<Measurement> {
    const summaryData = this.processMeasurementData(createDto);
    const newMeasurement = new this.measurementModel({
      ...createDto,
      ...summaryData,
    });
    return newMeasurement.save();
  }

  async updateMeasurement(
    id: string,
    updateDto: UpdateMeasurementDto,
  ): Promise<Measurement> {
    const summaryData = this.processMeasurementData(updateDto);
    const updated = await this.measurementModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            ...updateDto,
            ...summaryData,
          },
        },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException(`Measurement with ID "${id}" not found`);
    }
    return updated;
  }

  async getMeasurementByJobId(jobId: string): Promise<Measurement> {
    const measurement = await this.measurementModel.findOne({ jobId }).exec();
    if (!measurement) {
      throw new NotFoundException(
        `Measurement for Job ID "${jobId}" not found`,
      );
    }
    return measurement;
  }

  async getMeasurementsByStaff(staffId: string): Promise<Measurement[]> {
    return this.measurementModel.find({ assignedStaff: staffId }).exec();
  }

  async getMeasurementSummary(id: string) {
    const measurement = await this.measurementModel.findById(id).exec();
    if (!measurement) {
      throw new NotFoundException(`Measurement with ID "${id}" not found`);
    }

    return {
      id: measurement._id,
      jobId: measurement.jobId,
      status: measurement.status,
      totalRooms: measurement.totalRooms,
      totalOpenings: measurement.totalOpenings,
      totalWindows: measurement.totalWindows,
      totalDoors: measurement.totalDoors,
      visitDate: measurement.visitDate,
    };
  }
}
