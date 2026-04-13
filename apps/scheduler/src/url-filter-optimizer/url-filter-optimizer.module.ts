import { Module } from '@nestjs/common';
import { PrismaModule } from '@dealscrapper/database';
import { UrlFilterOptimizerService } from './url-filter-optimizer.service.js';

@Module({
  imports: [PrismaModule],
  providers: [UrlFilterOptimizerService],
  exports: [UrlFilterOptimizerService],
})
export class UrlFilterOptimizerModule {}
