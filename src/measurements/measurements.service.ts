import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { Job, JobDocument, JobMeasurements, JobStatus } from '../jobs/schemas/job.schema';
import { CreateMeasurementDto } from './dtos/create-measurement.dto';
import { UpdateMeasurementDto } from './dtos/update-measurement.dto';
import { RoomDto, OpeningDto } from './dtos/create-measurement.dto';

@Injectable()
export class MeasurementsService {
  constructor(
    @InjectModel(Job.name)
    private readonly jobModel: Model<JobDocument>,
  ) {}

  private processMeasurementData(
    dto: Partial<CreateMeasurementDto | UpdateMeasurementDto>,
  ): JobMeasurements {
    const rooms = dto.rooms || [];
    const {
      processedRooms,
      totalRooms,
      totalOpenings,
      totalWindows,
      totalDoors,
    } = this.calculateSummaryAndArea(rooms);

    return {
      assignedStaff: dto.assignedStaff,
      visitDate: dto.visitDate ? new Date(dto.visitDate) : undefined,
      status: dto.status || 'Completed',
      rooms: processedRooms as any,
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
  ): Promise<JobMeasurements> {
    const summaryData = this.processMeasurementData(createDto);
    const filter = isValidObjectId(createDto.jobId)
      ? { _id: createDto.jobId }
      : { jobId: createDto.jobId };

    const updateFields: Record<string, any> = { measurements: summaryData };
    if (createDto.status === 'Completed' || summaryData.status === 'Completed') {
      updateFields.status = JobStatus.ReadyForFitting;
    }

    const updatedJob = await this.jobModel
      .findOneAndUpdate(
        filter,
        { $set: updateFields },
        { new: true },
      )
      .exec();

    if (!updatedJob) {
      throw new NotFoundException(`Job with ID "${createDto.jobId}" not found`);
    }

    return updatedJob.measurements || summaryData;
  }

  async updateMeasurement(
    id: string,
    updateDto: UpdateMeasurementDto,
  ): Promise<JobMeasurements> {
    const summaryData = this.processMeasurementData(updateDto);
    const filter = isValidObjectId(id)
      ? { $or: [{ _id: id }, { jobId: id }] }
      : { jobId: id };

    const updateFields: Record<string, any> = { measurements: summaryData };
    if (updateDto.status === 'Completed' || summaryData.status === 'Completed') {
      updateFields.status = JobStatus.ReadyForFitting;
    }

    const updated = await this.jobModel
      .findOneAndUpdate(
        filter,
        { $set: updateFields },
        { new: true },
      )
      .exec();

    if (!updated || !updated.measurements) {
      throw new NotFoundException(`Measurement for Job ID "${id}" not found`);
    }
    return updated.measurements;
  }

  async getMeasurementByJobId(jobId: string): Promise<JobMeasurements> {
    const filter = isValidObjectId(jobId)
      ? { $or: [{ _id: jobId }, { jobId }] }
      : { jobId };

    const job = await this.jobModel.findOne(filter).exec();
    if (!job || !job.measurements) {
      throw new NotFoundException(
        `Measurement for Job ID "${jobId}" not found`,
      );
    }
    return job.measurements;
  }

  async getMeasurementsByStaff(staffId: string): Promise<JobMeasurements[]> {
    const jobs = await this.jobModel
      .find({ 'measurements.assignedStaff': staffId })
      .exec();

    return jobs
      .map((job) => job.measurements)
      .filter((m): m is JobMeasurements => Boolean(m));
  }

  async getMeasurementSummary(id: string) {
    const filter = isValidObjectId(id)
      ? { $or: [{ _id: id }, { jobId: id }] }
      : { jobId: id };

    const job = await this.jobModel.findOne(filter).exec();
    if (!job || !job.measurements) {
      throw new NotFoundException(`Measurement for Job ID "${id}" not found`);
    }

    return {
      id: job._id,
      jobId: job.jobId || job._id.toString(),
      status: job.measurements.status,
      totalRooms: job.measurements.totalRooms,
      totalOpenings: job.measurements.totalOpenings,
      totalWindows: job.measurements.totalWindows,
      totalDoors: job.measurements.totalDoors,
      visitDate: job.measurements.visitDate,
    };
  }
}
