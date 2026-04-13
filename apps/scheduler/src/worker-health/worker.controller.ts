import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WorkerHealthService } from './worker-health.service.js';
import { extractErrorMessage } from '@dealscrapper/shared';
import type { WorkerCapacity, JobType } from '../types/scheduler.types.js';
import {
  createSuccessResponse,
  type StandardApiResponse,
} from '@dealscrapper/shared-types';
import {
  WorkerRegistrationDto,
  WorkerHeartbeatDto,
  WorkerUnregistrationDto,
} from './dto/index.js';

/**
 * API controller for worker management endpoints
 * Provides HTTP endpoints for worker registration, heartbeat, and unregistration
 */
@ApiTags('workers')
@Controller('workers')
export class WorkerController {
  private readonly logger = new Logger(WorkerController.name);

  constructor(private readonly workerHealthService: WorkerHealthService) {}

  /**
   * Register a new worker with the scheduler
   * @param registrationData - Worker registration information
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async registerWorker(
    @Body() registrationData: WorkerRegistrationDto
  ): Promise<StandardApiResponse<null>> {
    try {
      // Convert readonly array to mutable for WorkerCapacity compatibility
      const capacity: WorkerCapacity = {
        ...registrationData.capacity,
        supportedJobTypes: [
          ...registrationData.capacity.supportedJobTypes,
        ] as JobType[],
      };

      await this.workerHealthService.registerWorker(
        registrationData.workerId,
        registrationData.endpoint,
        capacity,
        registrationData.site
      );

      this.logger.log(
        `✅ Worker registered: ${registrationData.workerId} at ${registrationData.endpoint}`
      );

      return createSuccessResponse(null, 'Worker registered successfully');
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      this.logger.error(
        `❌ Failed to register worker ${registrationData.workerId}: ${errorMessage}`
      );
      throw error;
    }
  }

  /**
   * Process worker heartbeat to update load and maintain connection
   * @param heartbeatData - Worker current status information
   */
  @Post('heartbeat')
  @HttpCode(HttpStatus.OK)
  async workerHeartbeat(
    @Body() heartbeatData: WorkerHeartbeatDto
  ): Promise<StandardApiResponse<null>> {
    try {
      await this.workerHealthService.updateWorkerLoad(
        heartbeatData.workerId,
        heartbeatData.currentLoad
      );

      this.logger.debug(
        `💓 Heartbeat received from worker ${heartbeatData.workerId} (load: ${heartbeatData.currentLoad})`
      );

      return createSuccessResponse(null, 'Heartbeat processed successfully');
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      this.logger.warn(
        `💔 Failed to process heartbeat from worker ${heartbeatData.workerId}: ${errorMessage}`
      );
      throw error;
    }
  }

  /**
   * Unregister a worker from the scheduler
   * @param unregistrationData - Worker identification for removal
   */
  @Post('unregister')
  @HttpCode(HttpStatus.OK)
  async unregisterWorker(
    @Body() unregistrationData: WorkerUnregistrationDto
  ): Promise<StandardApiResponse<null>> {
    try {
      await this.workerHealthService.unregisterWorker(
        unregistrationData.workerId
      );

      this.logger.log(`🛑 Worker unregistered: ${unregistrationData.workerId}`);

      return createSuccessResponse(null, 'Worker unregistered successfully');
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      this.logger.error(
        `❌ Failed to unregister worker ${unregistrationData.workerId}: ${errorMessage}`
      );
      throw error;
    }
  }
}
