import { Injectable } from '@nestjs/common';
import { PrismaService, ScheduledJob, Prisma } from '@dealscrapper/database';
import { AbstractBaseRepository } from '@dealscrapper/shared-repository';
import type {
  PaginationOptions,
  PaginatedResult,
} from '@dealscrapper/shared-repository';
import { calculatePaginationOffset } from '@dealscrapper/shared-repository';

/**
 * Scheduled job repository interface defining all scheduled job operations
 */
export interface IScheduledJobRepository {
  findByCategoryId(categoryId: string): Promise<ScheduledJob | null>;
  findActiveJobs(): Promise<ScheduledJob[]>;
  findInactiveJobs(): Promise<ScheduledJob[]>;
  findJobsDueForExecution(): Promise<ScheduledJob[]>;
  findJobsByFilterCount(
    minCount?: number,
    maxCount?: number
  ): Promise<ScheduledJob[]>;
  updateExecutionStats(
    jobId: string,
    stats: {
      totalExecutions?: number;
      successfulRuns?: number;
      lastExecutionAt?: Date;
      lastSuccessAt?: Date;
      avgExecutionTimeMs?: number;
    }
  ): Promise<ScheduledJob>;
  updateNextScheduledTime(
    jobId: string,
    nextScheduledAt: Date
  ): Promise<ScheduledJob>;
  incrementFilterCount(categoryId: string): Promise<ScheduledJob>;
  decrementFilterCount(categoryId: string): Promise<ScheduledJob>;
  toggleActive(jobId: string, isActive: boolean): Promise<ScheduledJob>;
  findJobsWithLowSuccess(): Promise<ScheduledJob[]>;
  findJobsWithHighExecution(): Promise<ScheduledJob[]>;
  getJobStatistics(): Promise<{
    totalJobs: number;
    activeJobs: number;
    jobsWithFilters: number;
    averageExecutionTime: number;
    successRate: number;
    byFilterCount: Record<string, number>;
  }>;
  cleanupOldJobs(olderThanDays: number): Promise<number>;
  healthCheck(): Promise<boolean>;
}

/**
 * Scheduled job repository implementation with comprehensive job management operations
 */
@Injectable()
export class ScheduledJobRepository
  extends AbstractBaseRepository<
    ScheduledJob,
    Prisma.ScheduledJobCreateInput,
    Prisma.ScheduledJobUpdateInput,
    Prisma.ScheduledJobWhereUniqueInput
  >
  implements IScheduledJobRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected getModel() {
    return this.prisma.scheduledJob;
  }

  /**
   * Find scheduled job by unique identifier
   */
  async findUnique(
    where: Prisma.ScheduledJobWhereUniqueInput
  ): Promise<ScheduledJob | null> {
    return this.executeWithErrorHandling(
      'findUnique',
      () => this.prisma.scheduledJob.findUnique({ where }),
      { where }
    );
  }

  /**
   * Find multiple scheduled jobs with optional filtering
   */
  async findMany(
    where?: Prisma.ScheduledJobWhereInput
  ): Promise<ScheduledJob[]> {
    return this.executeWithErrorHandling(
      'findMany',
      () =>
        this.prisma.scheduledJob.findMany({
          where,
          orderBy: { filterCount: 'desc' },
        }),
      { where }
    );
  }

  /**
   * Find scheduled jobs with pagination support
   */
  async findManyPaginated(
    where?: Prisma.ScheduledJobWhereInput,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<ScheduledJob>> {
    this.validatePagination(pagination);

    const page = pagination?.page || 1;
    const limit = pagination?.limit || 50;
    const skip = pagination?.offset || calculatePaginationOffset(page, limit);

    const [jobs, total] = await Promise.all([
      this.executeWithErrorHandling(
        'findManyPaginated',
        () =>
          this.prisma.scheduledJob.findMany({
            where,
            skip,
            take: limit,
            orderBy: { filterCount: 'desc' },
          }),
        { where, pagination }
      ),
      this.count(where),
    ]);

    return {
      data: jobs,
      pagination: this.calculatePaginationMetadata(total, pagination),
    };
  }

  /**
   * Count scheduled jobs matching criteria
   */
  async count(where?: Prisma.ScheduledJobWhereInput): Promise<number> {
    return this.executeWithErrorHandling(
      'count',
      () => this.prisma.scheduledJob.count({ where }),
      { where }
    );
  }

  /**
   * Create a new scheduled job
   */
  async create(data: Prisma.ScheduledJobCreateInput): Promise<ScheduledJob> {
    this.validateRequiredFields(data as Record<string, unknown>, [
      'categoryId',
    ]);

    return this.executeWithErrorHandling(
      'create',
      () => this.prisma.scheduledJob.create({ data }),
      { data }
    );
  }

  /**
   * Create multiple scheduled jobs in a transaction
   */
  async createMany(
    data: Prisma.ScheduledJobCreateInput[]
  ): Promise<ScheduledJob[]> {
    return this.executeWithErrorHandling(
      'createMany',
      async () => {
        const jobs: ScheduledJob[] = [];
        for (const jobData of data) {
          const job = await this.create(jobData);
          jobs.push(job);
        }
        return jobs;
      },
      { count: data.length }
    );
  }

  /**
   * Update an existing scheduled job
   */
  async update(
    where: Prisma.ScheduledJobWhereUniqueInput,
    data: Prisma.ScheduledJobUpdateInput
  ): Promise<ScheduledJob> {
    return this.executeWithErrorHandling(
      'update',
      () => this.prisma.scheduledJob.update({ where, data }),
      { where, data }
    );
  }

  /**
   * Update multiple scheduled jobs matching criteria
   */
  async updateMany(
    where: Prisma.ScheduledJobWhereInput,
    data: Prisma.ScheduledJobUpdateInput
  ): Promise<number> {
    const result = await this.executeWithErrorHandling(
      'updateMany',
      () => this.prisma.scheduledJob.updateMany({ where, data }),
      { where, data }
    );
    return result.count;
  }

  /**
   * Delete a scheduled job
   */
  async delete(
    where: Prisma.ScheduledJobWhereUniqueInput
  ): Promise<ScheduledJob> {
    return this.executeWithErrorHandling(
      'delete',
      () => this.prisma.scheduledJob.delete({ where }),
      { where }
    );
  }

  /**
   * Delete multiple scheduled jobs matching criteria
   */
  async deleteMany(where: Prisma.ScheduledJobWhereInput): Promise<number> {
    const result = await this.executeWithErrorHandling(
      'deleteMany',
      () => this.prisma.scheduledJob.deleteMany({ where }),
      { where }
    );
    return result.count;
  }

  /**
   * Create or update a scheduled job (upsert operation)
   */
  async upsert(
    where: Prisma.ScheduledJobWhereUniqueInput,
    create: Prisma.ScheduledJobCreateInput,
    update: Prisma.ScheduledJobUpdateInput
  ): Promise<ScheduledJob> {
    return this.executeWithErrorHandling(
      'upsert',
      () => this.prisma.scheduledJob.upsert({ where, create, update }),
      { where, create, update }
    );
  }

  /**
   * Check if a scheduled job exists
   */
  async exists(where: Prisma.ScheduledJobWhereUniqueInput): Promise<boolean> {
    const job = await this.findUnique(where);
    return job !== null;
  }

  // Scheduled job specific methods

  /**
   * Find scheduled job by category ID (1:1 relationship)
   */
  async findByCategoryId(categoryId: string): Promise<ScheduledJob | null> {
    return this.findUnique({ categoryId });
  }

  /**
   * Find all active scheduled jobs
   */
  async findActiveJobs(): Promise<ScheduledJob[]> {
    return this.findMany({ isActive: true });
  }

  /**
   * Find all inactive scheduled jobs
   */
  async findInactiveJobs(): Promise<ScheduledJob[]> {
    return this.findMany({ isActive: false });
  }

  /**
   * Find jobs that are due for execution
   */
  async findJobsDueForExecution(): Promise<ScheduledJob[]> {
    const now = new Date();

    return this.findMany({
      isActive: true,
      OR: [
        { nextScheduledAt: null }, // Never scheduled
        { nextScheduledAt: { lte: now } }, // Scheduled time has passed
      ],
    });
  }

  /**
   * Find jobs by filter count range
   */
  async findJobsByFilterCount(
    minCount?: number,
    maxCount?: number
  ): Promise<ScheduledJob[]> {
    const where: Prisma.ScheduledJobWhereInput = {};

    if (minCount !== undefined || maxCount !== undefined) {
      where.filterCount = {};
      if (minCount !== undefined) {
        where.filterCount.gte = minCount;
      }
      if (maxCount !== undefined) {
        where.filterCount.lte = maxCount;
      }
    }

    return this.findMany(where);
  }

  /**
   * Update execution statistics for a job
   */
  async updateExecutionStats(
    jobId: string,
    stats: {
      totalExecutions?: number;
      successfulRuns?: number;
      lastExecutionAt?: Date;
      lastSuccessAt?: Date;
      avgExecutionTimeMs?: number;
    }
  ): Promise<ScheduledJob> {
    const updateData: Prisma.ScheduledJobUpdateInput = {
      updatedAt: new Date(),
    };

    if (stats.totalExecutions !== undefined) {
      updateData.totalExecutions = stats.totalExecutions;
    }
    if (stats.successfulRuns !== undefined) {
      updateData.successfulRuns = stats.successfulRuns;
    }
    if (stats.lastExecutionAt !== undefined) {
      updateData.lastExecutionAt = stats.lastExecutionAt;
    }
    if (stats.lastSuccessAt !== undefined) {
      updateData.lastSuccessAt = stats.lastSuccessAt;
    }
    if (stats.avgExecutionTimeMs !== undefined) {
      updateData.avgExecutionTimeMs = stats.avgExecutionTimeMs;
    }

    return this.update({ id: jobId }, updateData);
  }

  /**
   * Update the next scheduled execution time
   */
  async updateNextScheduledTime(
    jobId: string,
    nextScheduledAt: Date
  ): Promise<ScheduledJob> {
    return this.update(
      { id: jobId },
      {
        nextScheduledAt,
        updatedAt: new Date(),
      }
    );
  }

  /**
   * Increment filter count for a category
   */
  async incrementFilterCount(categoryId: string): Promise<ScheduledJob> {
    return this.executeWithErrorHandling(
      'incrementFilterCount',
      () =>
        this.prisma.scheduledJob.update({
          where: { categoryId },
          data: {
            filterCount: { increment: 1 },
            updatedAt: new Date(),
          },
        }),
      { categoryId }
    );
  }

  /**
   * Decrement filter count for a category
   */
  async decrementFilterCount(categoryId: string): Promise<ScheduledJob> {
    return this.executeWithErrorHandling(
      'decrementFilterCount',
      () =>
        this.prisma.scheduledJob.update({
          where: { categoryId },
          data: {
            filterCount: { decrement: 1 },
            updatedAt: new Date(),
          },
        }),
      { categoryId }
    );
  }

  /**
   * Toggle job active status
   */
  async toggleActive(jobId: string, isActive: boolean): Promise<ScheduledJob> {
    return this.update(
      { id: jobId },
      {
        isActive,
        updatedAt: new Date(),
      }
    );
  }

  /**
   * Find jobs with low success rate (< 70%)
   */
  async findJobsWithLowSuccess(): Promise<ScheduledJob[]> {
    return this.executeWithErrorHandling(
      'findJobsWithLowSuccess',
      () =>
        this.prisma.scheduledJob.findMany({
          where: {
            totalExecutions: { gt: 5 }, // At least 5 executions
            OR: [
              {
                AND: [
                  { totalExecutions: { gt: 0 } },
                  {
                    successfulRuns: {
                      lt: this.prisma.scheduledJob.fields.totalExecutions,
                    },
                  },
                ],
              },
            ],
          },
          orderBy: { totalExecutions: 'desc' },
        }),
      {}
    );
  }

  /**
   * Find jobs with high execution frequency (executed recently and frequently)
   */
  async findJobsWithHighExecution(): Promise<ScheduledJob[]> {
    const recentThreshold = new Date();
    recentThreshold.setHours(recentThreshold.getHours() - 24); // Last 24 hours

    return this.findMany({
      lastExecutionAt: { gte: recentThreshold },
      totalExecutions: { gt: 10 },
    });
  }

  /**
   * Get comprehensive scheduled job statistics
   */
  async getJobStatistics(): Promise<{
    totalJobs: number;
    activeJobs: number;
    jobsWithFilters: number;
    averageExecutionTime: number;
    successRate: number;
    byFilterCount: Record<string, number>;
  }> {
    return this.executeWithErrorHandling(
      'getJobStatistics',
      async () => {
        const [
          totalJobs,
          activeJobs,
          jobsWithFilters,
          filterCountStats,
          executionStats,
        ] = await Promise.all([
          this.count(),
          this.count({ isActive: true }),
          this.count({ filterCount: { gt: 0 } }),
          this.prisma.scheduledJob.groupBy({
            by: ['filterCount'],
            _count: { id: true },
          }),
          this.prisma.scheduledJob.aggregate({
            _avg: { avgExecutionTimeMs: true },
            _sum: { totalExecutions: true, successfulRuns: true },
          }),
        ]);

        const byFilterCount: Record<string, number> = {};
        filterCountStats.forEach((stat) => {
          byFilterCount[stat.filterCount.toString()] = stat._count.id;
        });

        const totalExecutions = executionStats._sum.totalExecutions || 0;
        const successfulRuns = executionStats._sum.successfulRuns || 0;
        const averageExecutionTime =
          executionStats._avg.avgExecutionTimeMs || 0;
        const successRate =
          totalExecutions > 0 ? (successfulRuns / totalExecutions) * 100 : 0;

        return {
          totalJobs,
          activeJobs,
          jobsWithFilters,
          averageExecutionTime,
          successRate,
          byFilterCount,
        };
      },
      {}
    );
  }

  /**
   * Clean up old job execution records
   */
  async cleanupOldJobs(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    return this.executeWithErrorHandling(
      'cleanupOldJobs',
      async () => {
        // Reset old execution stats but keep the job records
        const result = await this.prisma.scheduledJob.updateMany({
          where: {
            lastExecutionAt: { lt: cutoffDate },
            isActive: false,
            filterCount: 0,
          },
          data: {
            totalExecutions: 0,
            successfulRuns: 0,
            lastExecutionAt: null,
            lastSuccessAt: null,
            avgExecutionTimeMs: null,
          },
        });
        return result.count;
      },
      { olderThanDays }
    );
  }

  /**
   * Repository health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.count();
      return true;
    } catch {
      return false;
    }
  }
}
