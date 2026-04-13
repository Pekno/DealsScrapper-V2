import { PartialType } from '@nestjs/swagger';
import { CreateFilterDto } from './create-filter.dto.js';

export class UpdateFilterDto extends PartialType(CreateFilterDto) {}
