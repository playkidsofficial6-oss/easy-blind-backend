import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

describe('UploadsController', () => {
  let controller: UploadsController;
  let service: UploadsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadsController],
      providers: [UploadsService],
    }).compile();

    controller = module.get<UploadsController>(UploadsController);
    service = module.get<UploadsService>(UploadsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  it('should successfully process single or multiple image file uploads', async () => {
    const mockFiles: Express.Multer.File[] = [
      {
        fieldname: 'files',
        originalname: 'test-image-1.png',
        encoding: '7bit',
        mimetype: 'image/png',
        size: 1024,
        filename: 'img-123456.png',
        destination: './uploads',
        path: './uploads/img-123456.png',
        buffer: Buffer.from(''),
        stream: null as any,
      },
      {
        fieldname: 'files',
        originalname: 'test-image-2.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 2048,
        filename: 'img-789012.jpg',
        destination: './uploads',
        path: './uploads/img-789012.jpg',
        buffer: Buffer.from(''),
        stream: null as any,
      },
    ];

    const response = await controller.uploadImages(mockFiles);
    expect(response.message).toBe('Images uploaded successfully');
    expect(response.data).toEqual([
      '/uploads/img-123456.png',
      '/uploads/img-789012.jpg',
    ]);
  });

  it('should throw BadRequestException if no files are uploaded', async () => {
    await expect(controller.uploadImages([])).rejects.toThrow(
      BadRequestException,
    );
  });
});
