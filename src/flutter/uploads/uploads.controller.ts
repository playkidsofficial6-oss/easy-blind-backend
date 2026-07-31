import {
  BadRequestException,
  Controller,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

const ALLOWED_IMAGE_MIMETYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/svg+xml',
  'image/tiff',
  'image/heic',
  'image/heif',
  'image/avif',
];

const ALLOWED_IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.svg',
  '.tiff',
  '.heic',
  '.heif',
  '.avif',
];

const multerImageOptions = {
  storage: diskStorage({
    destination: (req, file, callback) => {
      const uploadPath = join(process.cwd(), 'uploads');
      if (!existsSync(uploadPath)) {
        mkdirSync(uploadPath, { recursive: true });
      }
      callback(null, uploadPath);
    },
    filename: (req, file, callback) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = extname(file.originalname).toLowerCase();
      callback(null, `img-${uniqueSuffix}${ext}`);
    },
  }),
  fileFilter: (req: any, file: Express.Multer.File, callback: any) => {
    const ext = extname(file.originalname).toLowerCase();
    const isMimeValid = ALLOWED_IMAGE_MIMETYPES.includes(
      file.mimetype.toLowerCase(),
    );
    const isExtValid = ALLOWED_IMAGE_EXTENSIONS.includes(ext);

    if (!isMimeValid || !isExtValid) {
      return callback(
        new BadRequestException(
          `Invalid file format. Only image formats (${ALLOWED_IMAGE_EXTENSIONS.join(', ')}) are allowed!`,
        ),
        false,
      );
    }
    callback(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
  },
};

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiTags('flutter-uploads')
@Controller('flutter/uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) { }

  @Post()
  @ApiOperation({
    summary: 'Upload single or multiple image files (saved to /uploads)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description:
            'Image file(s) to upload (JPEG, PNG, WEBP, GIF, SVG, etc.)',
        },
      },
    },
  })
  @UseInterceptors(AnyFilesInterceptor(multerImageOptions))
  async uploadImages(@UploadedFiles() files: Express.Multer.File[]) {
    return this.uploadsService.handleImageUploads(files);
  }
}
