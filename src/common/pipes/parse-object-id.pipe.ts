import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { Types } from 'mongoose';

@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!value || typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(`Invalid ID: ${value}`);
    }
    return value.trim();
  }
}
