import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '@dealscrapper/database';
import type { User } from '@dealscrapper/database';
import type { UserRole } from '@dealscrapper/shared-types';
import { NotificationPriority, QUEUE_PRIORITIES } from '@dealscrapper/shared-types';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { SharedConfigService } from '@dealscrapper/shared-config';
import { UserRepository } from '../repositories/user.repository.js';
import { PasswordResetService } from '../auth/services/password-reset.service.js';
import { apiLogConfig } from '../config/logging.config.js';
import type {
  AdminUserResponseDto,
  DashboardResponseDto,
  DashboardMetricsDto,
  ServiceHealthDto,
  SchedulerHealthResponseDto,
  ScraperWorkerDto,
} from './dto/admin-response.dto.js';
import type { PaginatedResult } from '@dealscrapper/shared-repository';

const HEALTH_CHECK_TIMEOUT_MS = 5000;

interface PaginatedAdminUsers {
  data: AdminUserResponseDto[];
  pagination: PaginatedResult<User>['pagination'];
}

/**
 * Admin service providing dashboard metrics, user management,
 * and administrative operations
 */
@Injectable()
export class AdminService {
  private readonly logger = createServiceLogger(apiLogConfig);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userRepository: UserRepository,
    private readonly httpService: HttpService,
    private readonly sharedConfig: SharedConfigService,
    private readonly passwordResetService: PasswordResetService,
    @InjectQueue('notifications') private readonly notificationQueue: Queue
  ) {}

  /**
   * Fetches dashboard metrics including service health statuses and platform statistics.
   * API health is inferred (the endpoint itself proves the service is running).
   * Remote services are checked via HTTP calls with timeout.
   */
  async getDashboardMetrics(): Promise<DashboardResponseDto> {
    const [remoteHealth, metrics] = await Promise.all([
      this.fetchRemoteServiceHealth(),
      this.fetchPlatformMetrics(),
    ]);

    return {
      services: {
        api: { status: 'healthy', details: { message: 'API is operational' } },
        scraper: remoteHealth.scraper,
        notifier: remoteHealth.notifier,
        scheduler: remoteHealth.scheduler,
      },
      metrics,
    };
  }

  /**
   * Retrieves a paginated list of users, optionally filtered by search term.
   * Passwords are stripped from the response.
   */
  async getUsers(
    page: number,
    limit: number,
    search?: string
  ): Promise<PaginatedAdminUsers> {
    const paginationOptions = { page, limit };

    const result: PaginatedResult<User> = search
      ? await this.userRepository.searchUsers(search, paginationOptions)
      : await this.userRepository.findManyPaginated(
          undefined,
          paginationOptions
        );

    return {
      data: result.data.map((user) => this.stripPassword(user)),
      pagination: result.pagination,
    };
  }

  /**
   * Updates a user's role (e.g. USER -> ADMIN or vice versa).
   * Returns the updated user without password.
   */
  async updateUserRole(
    userId: string,
    role: UserRole
  ): Promise<AdminUserResponseDto> {
    const updatedUser = await this.userRepository.update(
      { id: userId },
      { role }
    );
    return this.stripPassword(updatedUser);
  }

  /**
   * Deletes a user account.
   * Prevents an admin from deleting their own account.
   */
  async deleteUser(userId: string, currentUserId: string): Promise<void> {
    if (userId === currentUserId) {
      throw new ForbiddenException('Cannot delete your own account');
    }

    // Verify user exists before attempting deletion
    const user = await this.userRepository.findUnique({ id: userId });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    await this.userRepository.delete({ id: userId });
    this.logger.log(`Admin deleted user ${userId}`);
  }

  /**
   * Initiates a password reset for a user via a one-time JWT reset URL.
   *
   * If an email provider is configured, queues a password-reset notification and returns null.
   * If no email provider is configured, skips the queue and returns the resetUrl so the
   * admin can share it with the user manually.
   */
  async resetUserPassword(userId: string): Promise<{ resetUrl: string } | null> {
    const user = await this.userRepository.findUnique({ id: userId });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const { resetUrl } = this.passwordResetService.generateResetToken(
      user.id,
      user.email,
      '24h',
    );

    const emailConfig = this.sharedConfig.getEmailConfig();
    if (emailConfig.service === 'none') {
      this.logger.log(
        `Admin initiated password reset for user ${userId} — no email provider configured, returning reset URL`,
      );
      return { resetUrl };
    }

    await this.notificationQueue.add(
      'password-reset',
      { userId, email: user.email, resetUrl, timestamp: new Date() },
      {
        priority: QUEUE_PRIORITIES[NotificationPriority.HIGH],
        attempts: 3,
        backoff: { type: 'exponential' as const, delay: 2000 },
      },
    );

    this.logger.log(
      `Admin initiated password reset for user ${userId} — notification queued to ${user.email}`,
    );
    return null;
  }

  /**
   * Returns API self-health by calling the local /health endpoint.
   * If this endpoint responds, the API is operational.
   */
  async getApiHealth(): Promise<ServiceHealthDto> {
    const port = this.sharedConfig.getServicePort();
    const apiUrl = `http://localhost:${port}`;
    try {
      return await this.fetchServiceHealth(apiUrl);
    } catch {
      // If the endpoint itself is running, the API is healthy
      return { status: 'healthy', details: { message: 'API is operational' } };
    }
  }

  /**
   * Proxies health check to the notifier service.
   */
  async getNotifierHealth(): Promise<ServiceHealthDto> {
    const notifierUrl = this.getServiceUrl('NOTIFIER_URL');
    try {
      return await this.fetchServiceHealth(notifierUrl);
    } catch {
      return { status: 'unreachable', details: { error: 'Notifier service unreachable' } };
    }
  }

  /**
   * Proxies health check to the scheduler service, then fetches detailed health
   * from each registered scraper worker in parallel.
   */
  async getSchedulerHealth(): Promise<SchedulerHealthResponseDto> {
    const schedulerUrl = this.getServiceUrl('SCHEDULER_URL');

    let schedulerHealth: ServiceHealthDto;
    let workerDetails: Array<{
      id: string;
      endpoint: string;
      site?: string | null;
      status: string;
      currentLoad: number;
      maxConcurrentJobs: number;
      supportedJobTypes: string[];
      lastHeartbeat: string;
    }> = [];

    try {
      const response = await firstValueFrom(
        this.httpService.get<Record<string, unknown>>(`${schedulerUrl}/health`, {
          timeout: HEALTH_CHECK_TIMEOUT_MS,
        })
      );
      const healthData = this.unwrapHealthResponse(response.data);
      schedulerHealth = {
        status: (healthData.status as string) || 'healthy',
        details: healthData,
      };

      // Extract worker details from the scheduler response
      const workers = healthData?.workers as Record<string, unknown> | undefined;
      if (workers && Array.isArray(workers.details)) {
        workerDetails = workers.details;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(`Scheduler health check failed: ${errorMessage}`);
      schedulerHealth = { status: 'unreachable', details: { error: errorMessage } };
    }

    // Fetch individual scraper health in parallel
    const scraperResults = await Promise.allSettled(
      workerDetails.map((worker) => this.fetchScraperWorkerHealth(worker))
    );

    const scrapers: ScraperWorkerDto[] = workerDetails.map((worker, index) => {
      const result = scraperResults[index];
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        id: worker.id,
        site: worker.site ?? undefined,
        status: 'unreachable',
        endpoint: worker.endpoint,
        currentLoad: worker.currentLoad,
        maxConcurrentJobs: worker.maxConcurrentJobs,
        supportedJobTypes: worker.supportedJobTypes,
        lastHeartbeat: worker.lastHeartbeat,
      };
    });

    return { scheduler: schedulerHealth, scrapers };
  }

  /**
   * Fetches health data from an individual scraper worker endpoint.
   */
  private async fetchScraperWorkerHealth(worker: {
    id: string;
    endpoint: string;
    site?: string | null;
    status: string;
    currentLoad: number;
    maxConcurrentJobs: number;
    supportedJobTypes: string[];
    lastHeartbeat: string;
  }): Promise<ScraperWorkerDto> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<Record<string, unknown>>(`${worker.endpoint}/health`, {
          timeout: HEALTH_CHECK_TIMEOUT_MS,
        })
      );

      const data = this.unwrapHealthResponse(response.data);
      return {
        id: worker.id,
        site: worker.site ?? undefined,
        status: (data?.status as string) || 'healthy',
        endpoint: worker.endpoint,
        currentLoad: worker.currentLoad,
        maxConcurrentJobs: worker.maxConcurrentJobs,
        supportedJobTypes: worker.supportedJobTypes,
        lastHeartbeat: worker.lastHeartbeat,
        browserPool: data?.puppeteerPool as ScraperWorkerDto['browserPool'],
        scraping: data?.scraping as ScraperWorkerDto['scraping'],
      };
    } catch {
      return {
        id: worker.id,
        site: worker.site ?? undefined,
        status: 'unreachable',
        endpoint: worker.endpoint,
        currentLoad: worker.currentLoad,
        maxConcurrentJobs: worker.maxConcurrentJobs,
        supportedJobTypes: worker.supportedJobTypes,
        lastHeartbeat: worker.lastHeartbeat,
      };
    }
  }

  /**
   * Returns platform-level metrics from the database.
   */
  async getMetrics(): Promise<DashboardMetricsDto> {
    return this.fetchPlatformMetrics();
  }

  /**
   * Unwraps a StandardApiResponse wrapper from health endpoints.
   * Health endpoints return { success: true, data: { ...healthData }, message: "..." }.
   * This extracts the actual health data from the `data` field.
   */
  private unwrapHealthResponse(
    responseData: Record<string, unknown>
  ): Record<string, unknown> {
    if (
      responseData?.success === true &&
      responseData?.data !== undefined &&
      typeof responseData.data === 'object' &&
      responseData.data !== null
    ) {
      return responseData.data as Record<string, unknown>;
    }
    return responseData;
  }

  /**
   * Fetches health status from remote services (scraper, notifier, scheduler)
   * using parallel HTTP calls with timeout.
   */
  private async fetchRemoteServiceHealth(): Promise<{
    scraper: ServiceHealthDto;
    notifier: ServiceHealthDto;
    scheduler: ServiceHealthDto;
  }> {
    const scraperUrl = this.getEnvWithFallback(
      'SCRAPER_URL',
      'http://localhost:3002'
    );
    const notifierUrl = this.getServiceUrl('NOTIFIER_URL');
    const schedulerUrl = this.getServiceUrl('SCHEDULER_URL');

    const [scraperResult, notifierResult, schedulerResult] =
      await Promise.allSettled([
        this.fetchServiceHealth(scraperUrl),
        this.fetchServiceHealth(notifierUrl),
        this.fetchServiceHealth(schedulerUrl),
      ]);

    return {
      scraper: this.resolveHealthResult(scraperResult, 'scraper'),
      notifier: this.resolveHealthResult(notifierResult, 'notifier'),
      scheduler: this.resolveHealthResult(schedulerResult, 'scheduler'),
    };
  }

  /**
   * Makes an HTTP GET request to a service's /health endpoint.
   * Automatically unwraps StandardApiResponse wrappers.
   */
  private async fetchServiceHealth(baseUrl: string): Promise<ServiceHealthDto> {
    const response = await firstValueFrom(
      this.httpService.get<Record<string, unknown>>(`${baseUrl}/health`, {
        timeout: HEALTH_CHECK_TIMEOUT_MS,
      })
    );

    const healthData = this.unwrapHealthResponse(response.data);

    return {
      status: (healthData.status as string) || 'healthy',
      details: healthData,
    };
  }

  /**
   * Resolves a Promise.allSettled result into a ServiceHealthDto.
   */
  private resolveHealthResult(
    result: PromiseSettledResult<ServiceHealthDto>,
    serviceName: string
  ): ServiceHealthDto {
    if (result.status === 'fulfilled') {
      return result.value;
    }

    const errorMessage =
      result.reason instanceof Error
        ? result.reason.message
        : String(result.reason);

    this.logger.warn(`Health check failed for ${serviceName}: ${errorMessage}`);

    return {
      status: 'unreachable',
      details: { error: errorMessage },
    };
  }

  /**
   * Fetches platform-level metrics from the database.
   */
  private async fetchPlatformMetrics(): Promise<{
    totalUsers: number;
    totalFilters: number;
    totalMatches: number;
    activeSessions: number;
  }> {
    const [totalUsers, totalFilters, totalMatches, activeSessions] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.filter.count(),
        this.prisma.match.count(),
        this.prisma.userSession.count({
          where: { expiresAt: { gt: new Date() } },
        }),
      ]);

    return { totalUsers, totalFilters, totalMatches, activeSessions };
  }

  /**
   * Strips the password field from a User object to produce an AdminUserResponseDto.
   */
  private stripPassword(user: User): AdminUserResponseDto {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...userWithoutPassword } = user;
    return {
      id: userWithoutPassword.id,
      email: userWithoutPassword.email,
      firstName: userWithoutPassword.firstName,
      lastName: userWithoutPassword.lastName,
      role: userWithoutPassword.role,
      emailVerified: userWithoutPassword.emailVerified,
      createdAt: userWithoutPassword.createdAt,
      lastLoginAt: userWithoutPassword.lastLoginAt,
    };
  }

  /**
   * Gets a service URL from SharedConfigService (for keys declared in envConfig).
   */
  private getServiceUrl(key: string): string {
    return this.sharedConfig.get<string>(key);
  }

  /**
   * Gets an environment variable value with a fallback default.
   * Used for env vars not declared in the API's envConfig (SCRAPER_URL, NOTIFIER_URL).
   */
  private getEnvWithFallback(key: string, fallback: string): string {
    return process.env[key] ?? fallback;
  }
}
