import { Module } from '@nestjs/common';
import { WorkerRegistrationService } from './worker-registration.service.js';

/**
 * Module for worker registration and health monitoring functionality
 */
@Module({
  providers: [WorkerRegistrationService],
  exports: [WorkerRegistrationService],
})
export class WorkerRegistrationModule {}
