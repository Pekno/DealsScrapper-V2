import { Injectable } from '@nestjs/common';
import { PrismaService, Prisma } from '@dealscrapper/database';
import type { ScrapingJob } from '@dealscrapper/database';
import { AbstractBaseRepository } from '@dealscrapper/shared-repository';
import type {
  PaginationOptions,
  PaginatedResult,
} from '@dealscrapper/shared-repository';

/**
 * Repository for managing ScrapingJob database operations
 * Handles execution tracking, status updates, and performance metrics
 */
@Injectable()
export class ScrapingJobRepository extends AbstractBaseRepository<
  ScrapingJob,
  Prisma.ScrapingJobCreateInput,
  Prisma.ScrapingJobUpdateInput,
  Prisma.ScrapingJobWhereInput
> {
  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }

  /**
   * Implementation of abstract method - returns the Prisma model delegate
   */
  protected getModel() {
    return this.prisma.scrapingJob;
  }

  /**
   * Override default includes to include related entities
   */
  protected getDefaultIncludes() {
    return {
      scheduledJob: {
        include: {
          category: true,
        },
      },
    };
  }

  /**
   * Create a new scraping job with initial processing status
   * @param scheduledJobId - ID of the scheduled job that triggered this execution
   * @param metadata - Additional job metadata (optional)
   * @returns Created scraping job record
   * @throws Error if the referenced ScheduledJob does not exist
   */
  async createProcessingJob(
    scheduledJobId: string,
    metadata?: Record<string, unknown>
  ): Promise<ScrapingJob> {
    // Verify ScheduledJob exists before attempting to create ScrapingJob
    const scheduledJobExists = await this.prisma.scheduledJob.findUnique({
      where: { id: scheduledJobId },
    });

    if (!scheduledJobExists) {
      throw new Error(
        `ScheduledJob with ID ${scheduledJobId} not found. Cannot create ScrapingJob for non-existent ScheduledJob.`
      );
    }

    return this.create({
      scheduledJob: {
        connect: {
          id: scheduledJobId,
        },
      },
      status: 'processing',
      attempts: 1,
      lastAttempt: new Date(),
      metadata: metadata as Prisma.InputJsonValue | undefined,
    });
  }

  /**
   * Update job status to completed with execution results
   * @param jobId - Scraping job ID
   * @param results - Execution results
   * @returns Updated scraping job record
   */
  async markCompleted(
    jobId: string,
    results: {
      dealsFound?: number;
      dealsProcessed?: number;
      executionTimeMs?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<ScrapingJob> {
    return this.update(
      { id: jobId },
      {
        status: 'completed',
        completedAt: new Date(),
        dealsFound: results.dealsFound,
        dealsProcessed: results.dealsProcessed,
        executionTimeMs: results.executionTimeMs,
        metadata: results.metadata as Prisma.InputJsonValue | undefined,
      }
    );
  }

  /**
   * Update job status to failed with error information
   * @param jobId - Scraping job ID
   * @param error - Error message or details
   * @param executionTimeMs - Time spent before failure (optional)
   * @returns Updated scraping job record
   */
  async markFailed(
    jobId: string,
    error: string,
    executionTimeMs?: number
  ): Promise<ScrapingJob> {
    return this.update(
      { id: jobId },
      {
        status: 'failed',
        completedAt: new Date(),
        error,
        executionTimeMs,
      }
    );
  }

  /**
   * Increment attempt count for a job (for retry scenarios)
   * @param jobId - Scraping job ID
   * @returns Updated scraping job record
   */
  async incrementAttempt(jobId: string): Promise<ScrapingJob> {
    const currentJob = await this.findUnique({ id: jobId });
    if (!currentJob) {
      throw new Error(`Scraping job with ID ${jobId} not found`);
    }

    return this.update(
      { id: jobId },
      {
        attempts: currentJob.attempts + 1,
        lastAttempt: new Date(),
        status: 'processing',
      }
    );
  }

  /**
   * Find recent scraping jobs by scheduled job ID
   * @param scheduledJobId - Scheduled job ID
   * @param limit - Maximum number of records to return
   * @returns Array of recent scraping jobs
   */
  async findRecentByScheduledJob(
    scheduledJobId: string,
    limit = 10
  ): Promise<ScrapingJob[]> {
    return this.prisma.scrapingJob.findMany({
      where: { scheduledJobId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get execution statistics for a scheduled job
   * @param scheduledJobId - Scheduled job ID
   * @returns Execution statistics
   */
  async getExecutionStats(scheduledJobId: string): Promise<{
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number | null;
    totalDealsFound: number;
  }> {
    const jobs = await this.findMany({ scheduledJobId });

    const totalExecutions = jobs.length;
    const successfulExecutions = jobs.filter(
      (job) => job.status === 'completed'
    ).length;
    const failedExecutions = jobs.filter(
      (job) => job.status === 'failed'
    ).length;

    const completedJobs = jobs.filter(
      (job) => job.status === 'completed' && job.executionTimeMs
    );
    const averageExecutionTime =
      completedJobs.length > 0
        ? completedJobs.reduce(
            (sum, job) => sum + (job.executionTimeMs || 0),
            0
          ) / completedJobs.length
        : null;

    const totalDealsFound = jobs.reduce(
      (sum, job) => sum + (job.dealsFound || 0),
      0
    );

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageExecutionTime,
      totalDealsFound,
    };
  }
}
