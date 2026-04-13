/**
 * E2E test helpers for scheduler service
 * Provides utilities for database setup, cleanup, and common test operations
 */

import { INestApplication } from '@nestjs/common';
import { PrismaService } from '@dealscrapper/database';
import { Category, ScheduledJob } from '@dealscrapper/database';
import {
  createGamingCategory,
  createHomeCategory,
  createLowEngagementCategory,
  createInactiveCategory,
  createHighPriorityJob,
  createStandardJob,
  createLowPriorityJob,
  createInactiveJob,
  createJobDueForExecution,
} from '../factories/index.js';

// Re-export factories for use in tests
export {
  createGamingCategory,
  createHomeCategory,
  createLowEngagementCategory,
  createInactiveCategory,
  createHighPriorityJob,
  createStandardJob,
  createLowPriorityJob,
  createInactiveJob,
  createJobDueForExecution,
};

/**
 * Test scenario data structure for complex business workflows
 */
export interface SchedulingScenario {
  categories: Category[];
  scheduledJobs: ScheduledJob[];
}

/**
 * Creates a realistic scheduling scenario with multiple categories and jobs
 * Represents a typical production state with varied engagement levels
 */
export async function createRealisticSchedulingScenario(
  prisma: PrismaService
): Promise<SchedulingScenario> {
  // Create diverse categories
  const gamingCategory = await prisma.category.create({
    data: createGamingCategory(),
  });

  const homeCategory = await prisma.category.create({
    data: createHomeCategory(),
  });

  const officeCategory = await prisma.category.create({
    data: createLowEngagementCategory(),
  });

  // Create corresponding scheduled jobs
  const highPriorityJob = await prisma.scheduledJob.create({
    data: createHighPriorityJob(gamingCategory.id),
  });

  const standardJob = await prisma.scheduledJob.create({
    data: createStandardJob(homeCategory.id),
  });

  const lowPriorityJob = await prisma.scheduledJob.create({
    data: createLowPriorityJob(officeCategory.id),
  });

  return {
    categories: [gamingCategory, homeCategory, officeCategory],
    scheduledJobs: [highPriorityJob, standardJob, lowPriorityJob],
  };
}

/**
 * Creates a category discovery test scenario
 * Used for testing category discovery and orchestration workflows
 */
export async function createCategoryDiscoveryScenario(
  prisma: PrismaService
): Promise<{ category: Category; hasScheduledJob: boolean }> {
  const newCategory = await prisma.category.create({
    data: createGamingCategory({
      name: 'New Gaming Monitors',
      slug: 'gaming-monitors-new',
      userCount: 0, // Freshly discovered category
      dealCount: 0,
    }),
  });

  return {
    category: newCategory,
    hasScheduledJob: false, // Should be created by discovery process
  };
}

/**
 * Creates a worker health monitoring scenario
 * Sets up multiple workers with different health states
 */
export function createWorkerHealthScenario() {
  return {
    healthyWorkers: [
      {
        workerId: 'worker-healthy-001',
        lastHeartbeat: new Date(),
        status: 'active',
        queueCount: 5,
      },
      {
        workerId: 'worker-healthy-002',
        lastHeartbeat: new Date(Date.now() - 30 * 1000), // 30 seconds ago
        status: 'active',
        queueCount: 3,
      },
    ],
    unhealthyWorkers: [
      {
        workerId: 'worker-stale-001',
        lastHeartbeat: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        status: 'stale',
        queueCount: 0,
      },
    ],
  };
}

/**
 * Comprehensive database cleanup for scheduler tests
 * Cleans all scheduler-related data in proper order to avoid FK constraints
 */
export async function cleanupSchedulerTestData(
  prisma: PrismaService
): Promise<void> {
  // Clean in dependency order to avoid foreign key constraints
  await prisma.scheduledJob.deleteMany({});
  await prisma.category.deleteMany({});

  // Clean any test filters that might reference categories
  await prisma.filterCategory.deleteMany({});
  await prisma.filter.deleteMany({
    where: {
      name: {
        contains: 'Test', // Only clean test filters
      },
    },
  });
}

/**
 * Waits for scheduled job to be updated by background processes
 * Useful for testing async scheduler operations
 */
export async function waitForJobUpdate(
  prisma: PrismaService,
  jobId: string,
  expectedField: keyof ScheduledJob,
  timeoutMs: number = 5000
): Promise<ScheduledJob | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const job = await prisma.scheduledJob.findUnique({
      where: { id: jobId },
    });

    if (
      job &&
      job[expectedField] !== null &&
      job[expectedField] !== undefined
    ) {
      return job;
    }

    // Wait 100ms before checking again
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return null;
}

/**
 * Verifies job execution statistics are within expected business ranges
 * Used to validate that adaptive scheduling produces realistic metrics
 */
export function validateJobExecutionStats(job: ScheduledJob): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Success rate should be reasonable (> 80%)
  if (job.totalExecutions > 0) {
    const successRate = job.successfulRuns / job.totalExecutions;
    if (successRate < 0.8) {
      issues.push(
        `Low success rate: ${(successRate * 100).toFixed(1)}% (expected > 80%)`
      );
    }
  }

  // Execution time should be reasonable (< 30 seconds)
  if (job.avgExecutionTimeMs && job.avgExecutionTimeMs > 30000) {
    issues.push(
      `High execution time: ${job.avgExecutionTimeMs}ms (expected < 30000ms)`
    );
  }

  // Timeout should be reasonable (5 seconds to 5 minutes)
  if (job.timeoutMs && (job.timeoutMs < 5000 || job.timeoutMs > 300000)) {
    issues.push(
      `Timeout out of bounds: ${job.timeoutMs}ms (expected 5000-300000)`
    );
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

/**
 * Creates a realistic filter for URL optimization testing
 */
export async function createTestFilter(
  prisma: PrismaService,
  categoryId: string
): Promise<{ filter: any; expectedOptimization: string }> {
  // Create test user if not exists
  let testUser = await prisma.user.findFirst({
    where: { email: 'test@scheduler.local' },
  });

  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        email: 'test@scheduler.local',
        password: 'hashed_password',
        emailVerified: true,
      },
    });
  }

  const filter = await prisma.filter.create({
    data: {
      name: 'Test Gaming Filter Under €800',
      description: 'Budget gaming laptop deals',
      active: true,
      filterExpression: {
        rules: [
          { field: 'currentPrice', operator: '<=', value: 800, weight: 2.0 },
          {
            field: 'title',
            operator: 'CONTAINS',
            value: 'gaming',
            weight: 1.5,
          },
          { field: 'temperature', operator: '>=', value: 60, weight: 1.0 },
        ],
        matchLogic: 'AND',
        minScore: 50,
      },
      user: {
        connect: { id: testUser.id },
      },
      categories: {
        create: [
          {
            category: {
              connect: { id: categoryId },
            },
          },
        ],
      },
    },
  });

  return {
    filter,
    expectedOptimization: 'price_max=800&temp_min=55', // Should include safety buffers
  };
}
