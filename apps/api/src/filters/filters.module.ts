import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FiltersService } from './filters.service.js';
import { FiltersController } from './filters.controller.js';
import { FilterMatcherService } from './services/filter-matcher.service.js';

@Module({
  imports: [HttpModule],
  controllers: [FiltersController],
  providers: [FiltersService, FilterMatcherService],
  exports: [FiltersService, FilterMatcherService],
})
export class FiltersModule {}
