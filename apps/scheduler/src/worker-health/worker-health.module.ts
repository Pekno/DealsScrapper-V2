import { Module } from '@nestjs/common';
import { WorkerHealthService } from './worker-health.service.js';
import { WorkerController } from './worker.controller.js';

/**
 * Module for worker health monitoring and management functionality
 * Provides both business logic and API endpoints for worker management
 */
@Module({
  imports: [],
  controllers: [WorkerController],
  providers: [WorkerHealthService],
  exports: [WorkerHealthService],
})
export class WorkerHealthModule {}
