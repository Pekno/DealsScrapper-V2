import { Module } from '@nestjs/common';
import { FilterMatchingService } from './filter-matching.service.js';
import { RuleEngineService } from './rule-engine.service.js';
// NotificationModule import removed - notifications handled by scheduler
// import { NotificationModule } from '../notification/notification.module.js';
import { SharedModule } from '../shared/shared.module.js';

@Module({
  imports: [SharedModule], // NotificationModule removed - notifications handled by scheduler
  providers: [FilterMatchingService, RuleEngineService],
  exports: [FilterMatchingService, RuleEngineService],
})
export class FilterMatchingModule {}
