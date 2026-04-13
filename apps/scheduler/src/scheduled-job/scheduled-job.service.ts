import { Injectable, Logger } from '@nestjs/common';
import { PrismaService, ScheduledJob, Prisma } from '@dealscrapper/database';

// Type for ScheduledJob with Category relation
type ScheduledJobWithCategory = Prisma.ScheduledJobGetPayload<{
  include: { category: true };
}>;

/**
 * Service to manage ScheduledJob lifecycle based on filter category associations
 * Ensures 1:1 relationship between Category and ScheduledJob with reference counting
 */
@Injectable()
export class ScheduledJobService {
  private readonly logger = new Logger(ScheduledJobService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ensures ScheduledJobs exist for all categories referenced by filters
   * Called when filters are created or updated
   * @param categoryIds - Array of category IDs that should have ScheduledJobs
   * @returns Promise resolving to created/updated ScheduledJob records
   */
  async ensureScheduledJobsForCategories(categoryIds: string[]): Promise<void> {
    this.logger.debug(
      `🔄 Ensuring scheduled jobs for ${categoryIds.length} categories`
    );

    for (const categoryId of categoryIds) {
      await this.createOrUpdateScheduledJob(categoryId);
    }

    this.logger.log(
      `✅ Processed scheduled jobs for ${categoryIds.length} categories`
    );
  }

  /**
   * Updates filter count and removes ScheduledJobs that are no longer needed
   * Called when filters are deleted or categories are removed from filters
   * @param categoryIds - Array of category IDs to check for cleanup
   */
  async cleanupUnusedScheduledJobs(categoryIds: string[]): Promise<void> {
    this.logger.debug(
      `🧹 Checking cleanup for ${categoryIds.length} categories`
    );

    for (const categoryId of categoryIds) {
      await this.updateFilterCountAndCleanup(categoryId);
    }

    this.logger.log(
      `✅ Cleanup completed for ${categoryIds.length} categories`
    );
  }

  /**
   * Gets all active ScheduledJobs for the adaptive scheduler
   * @returns Promise resolving to array of active ScheduledJob records with category data
   */
  async getActiveScheduledJobs(
    categoryIds?: string[]
  ): Promise<ScheduledJobWithCategory[]> {
    return this.prisma.scheduledJob.findMany({
      where: {
        isActive: true,
        filterCount: { gt: 0 }, // Only jobs with filters
        ...(categoryIds && { categoryId: { in: categoryIds } }),
      },
      include: {
        category: true, // Use complete Category entity instead of select
      },
      orderBy: {
        category: {
          userCount: 'desc', // Prioritize categories with more users
        },
      },
    });
  }

  /**
   * Updates execution statistics for a ScheduledJob after a scraping run
   * @param scheduledJobId - ID of the ScheduledJob to update
   * @param success - Whether the execution was successful
   * @param executionTimeMs - Time taken for the execution in milliseconds
   * @param dealsFound - Number of deals found (optional)
   */
  async updateExecutionStats(
    scheduledJobId: string,
    success: boolean,
    executionTimeMs: number,
    dealsFound?: number
  ): Promise<void> {
    try {
      await this.prisma.scheduledJob.update({
        where: { id: scheduledJobId },
        data: {
          totalExecutions: { increment: 1 },
          successfulRuns: success ? { increment: 1 } : undefined,
          lastExecutionAt: new Date(),
          lastSuccessAt: success ? new Date() : undefined,
          avgExecutionTimeMs: await this.calculateAvgExecutionTime(
            scheduledJobId,
            executionTimeMs
          ),
        },
      });

      this.logger.debug(
        `📊 Updated execution stats for scheduled job ${scheduledJobId}: ` +
          `success=${success}, time=${executionTimeMs}ms, deals=${dealsFound || 'N/A'}`
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to update execution stats for scheduled job ${scheduledJobId}:`,
        error
      );
    }
  }

  /**
   * Sets the next scheduled execution time for a ScheduledJob
   * @param scheduledJobId - ID of the ScheduledJob
   * @param nextExecutionTime - When the job should run next
   */
  async updateNextScheduledTime(
    scheduledJobId: string,
    nextExecutionTime: Date
  ): Promise<void> {
    await this.prisma.scheduledJob.update({
      where: { id: scheduledJobId },
      data: { nextScheduledAt: nextExecutionTime },
    });
  }

  /**
   * Creates or updates a ScheduledJob for a category and increments filter count
   * @private
   */
  private async createOrUpdateScheduledJob(categoryId: string): Promise<void> {
    try {
      // Try to update existing ScheduledJob
      const updated = await this.prisma.scheduledJob.updateMany({
        where: { categoryId },
        data: {
          filterCount: { increment: 1 },
          isActive: true,
        },
      });

      if (updated.count === 0) {
        // Create new ScheduledJob if none exists
        await this.prisma.scheduledJob.create({
          data: {
            categoryId,
            filterCount: 1,
            isActive: true,
          },
        });

        this.logger.debug(
          `🆕 Created new ScheduledJob for category ${categoryId}`
        );
      } else {
        this.logger.debug(`🔄 Updated filter count for category ${categoryId}`);
      }
    } catch (error) {
      this.logger.error(
        `❌ Failed to create/update ScheduledJob for category ${categoryId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Updates filter count and removes ScheduledJob if no longer needed
   * @private
   */
  private async updateFilterCountAndCleanup(categoryId: string): Promise<void> {
    try {
      // Count how many active filters reference this category
      const filterCount = await this.prisma.filterCategory.count({
        where: {
          categoryId,
          filter: {
            active: true,
          },
        },
      });

      if (filterCount === 0) {
        // No active filters reference this category, remove ScheduledJob
        const deleted = await this.prisma.scheduledJob.deleteMany({
          where: { categoryId },
        });

        if (deleted.count > 0) {
          this.logger.debug(
            `🗑️ Removed unused ScheduledJob for category ${categoryId}`
          );
        }
      } else {
        // Update the filter count
        await this.prisma.scheduledJob.updateMany({
          where: { categoryId },
          data: { filterCount },
        });

        this.logger.debug(
          `🔄 Updated filter count to ${filterCount} for category ${categoryId}`
        );
      }
    } catch (error) {
      this.logger.error(
        `❌ Failed to cleanup ScheduledJob for category ${categoryId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Calculates the average execution time for a ScheduledJob
   * @private
   */
  private async calculateAvgExecutionTime(
    scheduledJobId: string,
    newExecutionTime: number
  ): Promise<number> {
    const job = await this.prisma.scheduledJob.findUnique({
      where: { id: scheduledJobId },
      // Use complete entity instead of select for better type safety
    });

    if (!job || job.totalExecutions === 0) {
      return newExecutionTime;
    }

    const currentAvg = job.avgExecutionTimeMs || 0;
    const totalExecutions = job.totalExecutions;

    // Calculate new average: (old_avg * old_count + new_value) / new_count
    return Math.round(
      (currentAvg * totalExecutions + newExecutionTime) / (totalExecutions + 1)
    );
  }
}
