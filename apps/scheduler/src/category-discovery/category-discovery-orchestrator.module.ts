import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CategoryDiscoveryOrchestrator } from './category-discovery-orchestrator.service.js';
import { CategoryDiscoveryController } from './category-discovery.controller.js';
import { JobDistributorModule } from '../job-distributor/job-distributor.module.js';

/**
 * Module for category discovery orchestration functionality
 * Includes both the service layer and HTTP API endpoints
 */
@Module({
  imports: [
    // ScheduleModule.forRoot() removed - already configured in main SchedulerModule
    JobDistributorModule,
  ],
  controllers: [CategoryDiscoveryController],
  providers: [CategoryDiscoveryOrchestrator],
  exports: [CategoryDiscoveryOrchestrator],
})
export class CategoryDiscoveryOrchestratorModule {}
