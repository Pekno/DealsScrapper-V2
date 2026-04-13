import { Module } from '@nestjs/common';
import { UrlFilterOptimizerService } from './url-filter-optimizer.service.js';

/**
 * Module for URL optimization services
 * Provides services for optimizing scraping URLs using filter constraints
 */
@Module({
  providers: [UrlFilterOptimizerService],
  exports: [UrlFilterOptimizerService],
})
export class UrlOptimizationModule {}
