import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { Types } from 'mongoose';

@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!Types.ObjectId.isValid(value) && !/^JOB-\d{4}-\d{4}$/i.test(value)) {
      throw new BadRequestException(`Invalid MongoDB ObjectId or Job ID: ${value}`);
    }
    return value;
  }
}
