import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { SharedConfigService } from '@dealscrapper/shared-config';
import { COMMON_CONFIG, extractErrorMessage } from '@dealscrapper/shared';
import axios from 'axios';
import type {
  WorkerCapacity,
  WorkerHealthStatus,
} from '../types/worker.types.js';

/**
 * Worker registration configuration constants
 */
const REGISTRATION_CONFIG = {
  HEARTBEAT_INTERVAL_MS: COMMON_CONFIG.TIMEOUTS.DEFAULT, // 30 seconds
  INITIAL_RETRY_DELAY_MS: COMMON_CONFIG.TIMEOUTS.SHORT, // 5 seconds
  MAX_RETRY_ATTEMPTS: COMMON_CONFIG.RETRIES.MAX_ATTEMPTS_CRITICAL,
  REQUEST_TIMEOUT_MS: COMMON_CONFIG.TIMEOUTS.QUICK, // 3 seconds
} as const;

/**
 * Service responsible for registering this worker with the scheduler
 * and maintaining heartbeat connection
 */
@Injectable()
export class WorkerRegistrationService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(WorkerRegistrationService.name);
  private heartbeatInterval?: NodeJS.Timeout;
  private readonly workerId: string;
  private readonly workerEndpoint: string;
  private readonly schedulerEndpoint: string;
  private readonly capacity: WorkerCapacity;
  private currentLoad = 0;

  constructor(private readonly sharedConfig: SharedConfigService) {
    this.workerId = this.sharedConfig.get<string>('WORKER_ID');
    // Use the same port as the scraper service
    const scraperPort = this.sharedConfig.getServicePort();
    this.workerEndpoint = this.sharedConfig.get<string>('WORKER_ENDPOINT');
    this.schedulerEndpoint = this.sharedConfig.get<string>('SCHEDULER_URL');

    this.capacity = {
      maxConcurrentJobs: this.sharedConfig.get<number>(
        'WORKER_MAX_CONCURRENT_JOBS'
      ),
      maxMemoryMB: this.sharedConfig.get<number>('WORKER_MAX_MEMORY_MB'),
      supportedJobTypes: [
        'scrape-category',
        'category-discovery',
        'manual-category-discovery',
      ],
    };
  }

  /**
   * Initialize worker registration with scheduler on module startup
   */
  async onModuleInit(): Promise<void> {
    await this.registerWithScheduler();
    this.startHeartbeat();

    // Register graceful shutdown handlers
    process.on('SIGTERM', () => this.gracefulShutdown());
    process.on('SIGINT', () => this.gracefulShutdown());
  }

  /**
   * Handle application shutdown through NestJS lifecycle
   */
  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(
      `🛑 Application shutdown signal received: ${signal || 'unknown'}`
    );
    await this.gracefulShutdown();
  }

  /**
   * Registers this worker instance with the scheduler service
   * @returns Promise that resolves when registration is complete
   * @throws Error if registration fails after all retry attempts
   */
  async registerWithScheduler(): Promise<void> {
    let retryCount = 0;

    while (retryCount < REGISTRATION_CONFIG.MAX_RETRY_ATTEMPTS) {
      try {
        const scraperSite = process.env.SCRAPER_SITE?.toLowerCase();
        const registrationData = {
          workerId: this.workerId,
          endpoint: this.workerEndpoint,
          ...(scraperSite && scraperSite !== 'all' ? { site: scraperSite } : {}),
          capacity: this.capacity,
        };

        const response = await axios.post(
          `${this.schedulerEndpoint}/workers/register`,
          registrationData,
          {
            timeout: REGISTRATION_CONFIG.REQUEST_TIMEOUT_MS,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': '@dealscrapper/scraper',
            },
          }
        );

        if (response.status === 200 || response.status === 201) {
          this.logger.log(
            `✅ Successfully registered worker ${this.workerId} with scheduler at ${this.schedulerEndpoint}`
          );
          this.logger.log(
            `📋 Worker capacity: ${this.capacity.maxConcurrentJobs} concurrent jobs, ${this.capacity.maxMemoryMB}MB memory`
          );
          return;
        }

        throw new Error(`Unexpected response status: ${response.status}`);
      } catch (error) {
        retryCount++;
        const errorMessage = extractErrorMessage(error);

        this.logger.warn(
          `⚠️ Failed to register with scheduler (attempt ${retryCount}/${REGISTRATION_CONFIG.MAX_RETRY_ATTEMPTS}): ${errorMessage}`
        );

        if (retryCount < REGISTRATION_CONFIG.MAX_RETRY_ATTEMPTS) {
          const delay =
            REGISTRATION_CONFIG.INITIAL_RETRY_DELAY_MS *
            Math.pow(2, retryCount - 1);
          this.logger.debug(`⏳ Retrying registration in ${delay}ms...`);
          await this.sleep(delay);
        } else {
          this.logger.error(
            `❌ Failed to register worker after ${REGISTRATION_CONFIG.MAX_RETRY_ATTEMPTS} attempts. Shutting down worker...`
          );
          // Worker cannot function without scheduler integration - exit the process
          this.logger.error(
            '🛑 Worker requires scheduler connection to operate. Exiting process.'
          );
          process.exit(1);
        }
      }
    }
  }

  /**
   * Updates the current job load for this worker
   * @param load - Number of currently active jobs
   */
  updateCurrentLoad(load: number): void {
    if (load !== this.currentLoad) {
      this.currentLoad = load;
      this.logger.debug(
        `📊 Worker load updated: ${load}/${this.capacity.maxConcurrentJobs} jobs`
      );
    }
  }

  /**
   * Gets current worker health status for health check endpoint
   * @returns Current health status information
   */
  getHealthStatus(): WorkerHealthStatus {
    const isHealthy = this.currentLoad < this.capacity.maxConcurrentJobs;

    return {
      isHealthy,
      currentLoad: this.currentLoad,
      lastCheck: new Date(),
      responseTime: 0, // Will be calculated by health check requester
    };
  }

  /**
   * Gets worker identification and capacity information
   */
  getWorkerInfo() {
    return {
      workerId: this.workerId,
      endpoint: this.workerEndpoint,
      capacity: this.capacity,
      currentLoad: this.currentLoad,
    };
  }

  /**
   * Starts periodic heartbeat to maintain connection with scheduler
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.sendHeartbeat();
      } catch (error) {
        // Log but don't crash - heartbeat failures are handled gracefully by scheduler
        this.logger.debug(`💔 Heartbeat failed: ${extractErrorMessage(error)}`);
      }
    }, REGISTRATION_CONFIG.HEARTBEAT_INTERVAL_MS);

    this.logger.log(
      `💓 Started heartbeat with ${REGISTRATION_CONFIG.HEARTBEAT_INTERVAL_MS / 1000}s interval`
    );
  }

  /**
   * Sends heartbeat signal to scheduler with current worker status
   */
  private async sendHeartbeat(): Promise<void> {
    const heartbeatData = {
      workerId: this.workerId,
      currentLoad: this.currentLoad,
      status: 'active',
      timestamp: new Date().toISOString(),
    };

    try {
      await axios.post(
        `${this.schedulerEndpoint}/workers/heartbeat`,
        heartbeatData,
        {
          timeout: REGISTRATION_CONFIG.REQUEST_TIMEOUT_MS,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': '@dealscrapper/scraper-worker',
          },
        }
      );
    } catch (error) {
      // Handle 401 Unauthorized - worker needs to re-register
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        this.logger.warn(
          `💔 Scheduler says worker is not registered (401). Attempting re-registration...`
        );

        try {
          await this.registerWithScheduler();
          this.logger.log(
            `✅ Successfully re-registered worker ${this.workerId} after 401 response`
          );
        } catch (reregisterError) {
          this.logger.error(
            `❌ Failed to re-register worker after 401: ${reregisterError instanceof Error ? reregisterError.message : String(reregisterError)}`
          );
        }
      } else {
        // Re-throw other errors to be handled by the calling function
        throw error;
      }
    }
  }

  /**
   * Handles graceful shutdown by unregistering from scheduler
   */
  private async gracefulShutdown(): Promise<void> {
    this.logger.log('🛑 Shutting down worker gracefully...');

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    try {
      await axios.post(
        `${this.schedulerEndpoint}/workers/unregister`,
        { workerId: this.workerId },
        {
          timeout: REGISTRATION_CONFIG.REQUEST_TIMEOUT_MS,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': '@dealscrapper/scraper-worker',
          },
        }
      );

      this.logger.log('✅ Successfully unregistered from scheduler');
    } catch (error) {
      this.logger.warn(
        `⚠️ Failed to unregister from scheduler: ${extractErrorMessage(error)}`
      );
    }
  }

  /**
   * Generates a unique worker identifier
   */
  private generateWorkerId(): string {
    const hostname = this.sharedConfig.get<string>('HOSTNAME') || 'worker';
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${hostname}-${timestamp}-${random}`;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
