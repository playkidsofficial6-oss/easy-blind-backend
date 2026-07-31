import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class UploadsService {
  handleImageUploads(files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one image file is required');
    }

    const paths = files.map((file) => `/uploads/${file.filename}`);

    return {
      message: 'Images uploaded successfully',
      data: paths,
    };
  }
}
