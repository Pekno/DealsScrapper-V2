import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@dealscrapper/database';

/**
 * Service for updating ScheduledJob execution statistics from scraper
 * Provides methods to update job performance metrics after scraping completion
 *
 * TODO: This service is registered in JobProcessorModule but never injected or called by any processor.
 * Either wire it into the scrape processors to track execution stats, or remove it.
 */
@Injectable()
export class ScheduledJobService {
  private readonly logger = new Logger(ScheduledJobService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Updates execution statistics for a ScheduledJob after scraping completion
   * @param scheduledJobId - ID of the ScheduledJob to update
   * @param success - Whether the scraping execution was successful
   * @param executionTimeMs - Actual scraping execution time in milliseconds
   * @param dealsFound - Number of deals found during scraping
   * @throws Error if the update fails
   */
  async updateExecutionStats(
    scheduledJobId: string,
    success: boolean,
    executionTimeMs: number,
    dealsFound?: number
  ): Promise<void> {
    try {
      const currentAvgTime = await this.calculateNewAverageExecutionTime(
        scheduledJobId,
        executionTimeMs
      );

      await this.prisma.scheduledJob.update({
        where: { id: scheduledJobId },
        data: {
          totalExecutions: { increment: 1 },
          successfulRuns: success ? { increment: 1 } : undefined,
          lastExecutionAt: new Date(),
          lastSuccessAt: success ? new Date() : undefined,
          avgExecutionTimeMs: currentAvgTime,
        },
      });

      this.logger.debug(
        `📊 Updated ScheduledJob stats: id=${scheduledJobId}, ` +
          `success=${success}, time=${executionTimeMs}ms, deals=${dealsFound ?? 'N/A'}`
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to update ScheduledJob stats for ${scheduledJobId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Calculates the new average execution time for a ScheduledJob
   * @param scheduledJobId - ID of the ScheduledJob
   * @param newExecutionTime - New execution time to include in average
   * @returns Promise resolving to the new average execution time
   * @private
   */
  private async calculateNewAverageExecutionTime(
    scheduledJobId: string,
    newExecutionTime: number
  ): Promise<number> {
    const scheduledJob = await this.prisma.scheduledJob.findUnique({
      where: { id: scheduledJobId },
    });

    if (!scheduledJob || scheduledJob.totalExecutions === 0) {
      return newExecutionTime;
    }

    const currentAverage = scheduledJob.avgExecutionTimeMs ?? 0;
    const currentExecutions = scheduledJob.totalExecutions;

    // Calculate new average: (old_avg * old_count + new_value) / new_count
    return Math.round(
      (currentAverage * currentExecutions + newExecutionTime) /
        (currentExecutions + 1)
    );
  }
}
