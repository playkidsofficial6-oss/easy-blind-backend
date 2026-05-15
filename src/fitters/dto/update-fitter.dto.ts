import { PartialType } from '@nestjs/swagger';
import { CreateFitterDto } from './create-fitter.dto';

export class UpdateFitterDto extends PartialType(CreateFitterDto) {}
