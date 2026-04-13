import { Test, TestingModule } from '@nestjs/testing';
import { AdaptiveSchedulerService } from '../../../src/adaptive-scheduler/adaptive-scheduler.service';
import { PrismaService } from '@dealscrapper/database';
import { MultiSiteJobDistributorService } from '../../../src/job-distributor/multi-site-job-distributor.service';
import { ScheduledJobService } from '../../../src/scheduled-job/scheduled-job.service';
import type { CategoryStructure } from '@dealscrapper/shared-types';

describe('Adaptive Scheduling Business Logic', () => {
  let service: AdaptiveSchedulerService;
  let mockPrisma: jest.Mocked<PrismaService>;
  let mockMultiSiteDistributor: jest.Mocked<MultiSiteJobDistributorService>;
  let mockScheduledJobService: jest.Mocked<ScheduledJobService>;

  // Test data factories for business scenarios
  const createTestCategory = (overrides = {}): any => ({
    id: 'cat-123',
    slug: 'gaming-laptops',
    name: 'Gaming Laptops',
    siteId: 'dealabs',
    isActive: true,
    userCount: 25,
    dealCount: 150,
    avgTemperature: 85,
    sourceUrl: 'https://dealabs.com/groupe/gaming-laptops',
    level: 1,
    popularBrands: ['ASUS', 'MSI', 'Lenovo'],
    createdAt: new Date(),
    updatedAt: new Date(),
    parentId: null,
    description: null,
    ...overrides,
  });

  const createTestScheduledJob = (overrides = {}): any => ({
    id: 'sched-123',
    categorySlug: 'gaming-laptops',
    categoryId: 'cat-123',
    nextScheduledAt: new Date(Date.now() + 600000), // 10 minutes from now
    optimizedQuery: 'temperatureFrom=80&priceFrom=500',
    category: createTestCategory(),
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    maxRetries: 3,
    timeoutMs: 60000,
    totalExecutions: 0,
    successfulRuns: 0,
    failedRuns: 0,
    lastExecutionAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastErrorMessage: null,
    optimizationUpdatedAt: null,
    ...overrides,
  });

  beforeEach(async () => {
    // Mock PrismaService with business-focused database operations
    mockPrisma = {
      category: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      scheduledJob: {
        findUnique: jest.fn(),
      },
    } as any;

    // Mock MultiSiteJobDistributorService
    mockMultiSiteDistributor = {
      distributeScrapeJob: jest.fn().mockResolvedValue({ id: 'multi-job-123' }),
      getQueueStats: jest.fn().mockResolvedValue({ site: 'dealabs', waiting: 0, active: 0, completed: 0, failed: 0 }),
      getAllQueuesStats: jest.fn().mockResolvedValue([]),
      pauseQueue: jest.fn().mockResolvedValue(undefined),
      resumeQueue: jest.fn().mockResolvedValue(undefined),
      clearQueue: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Mock ScheduledJobService
    mockScheduledJobService = {
      getActiveScheduledJobs: jest.fn(),
      updateNextScheduledTime: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdaptiveSchedulerService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: MultiSiteJobDistributorService,
          useValue: mockMultiSiteDistributor,
        },
        {
          provide: ScheduledJobService,
          useValue: mockScheduledJobService,
        },
      ],
    }).compile();

    service = module.get<AdaptiveSchedulerService>(AdaptiveSchedulerService);
  });

  describe('Optimal Interval Calculation Business Rules', () => {
    it('calculates high-frequency intervals for popular categories with many users', () => {
      // Arrange - Popular gaming category with high user engagement
      const popularCategory = createTestCategory({
        slug: 'rtx-4090-deals',
        userCount: 200, // Many users monitoring
        dealCount: 500,
        avgTemperature: 120, // High community interest
      });

      // Act
      const intervalMs = (service as any).calculateOptimalInterval(
        popularCategory
      );

      // Assert - Should have short interval due to high user count and temperature
      expect(intervalMs).toBeLessThan(10 * 60 * 1000); // Less than 10 minutes
      expect(intervalMs).toBeGreaterThanOrEqual(5 * 60 * 1000); // But at least 5 minutes (minimum)
    });

    it('calculates low-frequency intervals for niche categories with few users', () => {
      // Arrange - Niche category with minimal user interest
      // Mock off-peak hours to ensure consistent test behavior
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(3); // 3 AM - off-peak

      const nicheCategory = createTestCategory({
        slug: 'vintage-typewriters',
        userCount: 2, // Very few users
        dealCount: 10, // Few deals
        avgTemperature: 30, // Low community temperature
      });

      // Act
      const intervalMs = (service as any).calculateOptimalInterval(
        nicheCategory
      );

      // Assert - Should have longer interval than base (10 minutes), but algorithm caps it
      expect(intervalMs).toBeGreaterThan(10 * 60 * 1000); // More than base 10 minutes
      expect(intervalMs).toBeLessThanOrEqual(30 * 60 * 1000); // But not exceed maximum

      // Cleanup mock
      jest.restoreAllMocks();
    });

    it('applies peak hours multiplier during business hours for faster scraping', () => {
      // Arrange - Category during peak hours (10 AM)
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(10);
      const category = createTestCategory({
        userCount: 50,
        dealCount: 200,
        avgTemperature: 85,
      });

      // Act
      const peakInterval = (service as any).calculateOptimalInterval(category);

      // Reset to off-peak hours (3 AM) for comparison
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(3);
      const offPeakInterval = (service as any).calculateOptimalInterval(
        category
      );

      // Assert - Peak hours should have shorter interval (higher frequency)
      expect(peakInterval).toBeLessThan(offPeakInterval);
    });

    it('applies hot category multiplier for categories with high temperature', () => {
      // Arrange - Hot category exceeding temperature threshold (100)
      // Mock off-peak hours to ensure consistent test behavior
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(3); // 3 AM - off-peak

      const hotCategory = createTestCategory({
        slug: 'black-friday-deals',
        userCount: 50,
        dealCount: 200,
        avgTemperature: 150, // Very hot category
      });

      // Act
      const hotInterval = (service as any).calculateOptimalInterval(
        hotCategory
      );

      // Compare with cooler category
      const coolCategory = createTestCategory({
        ...hotCategory,
        avgTemperature: 70, // Below hot threshold
      });
      const coolInterval = (service as any).calculateOptimalInterval(
        coolCategory
      );

      // Assert - Hot categories should scrape more frequently (shorter interval)
      expect(hotInterval).toBeLessThan(coolInterval);

      // Cleanup mock
      jest.restoreAllMocks();
    });

    it('enforces minimum and maximum interval bounds for system stability', () => {
      // Arrange - Extreme category that would calculate very short interval
      const extremeHighActivity = createTestCategory({
        userCount: 1000, // Extremely high user count
        dealCount: 10000,
        avgTemperature: 300,
      });

      // Arrange - Extreme category that would calculate very long interval
      const extremeLowActivity = createTestCategory({
        userCount: 0, // No users
        dealCount: 0,
        avgTemperature: 0,
      });

      // Act
      const highActivityInterval = (service as any).calculateOptimalInterval(
        extremeHighActivity
      );
      const lowActivityInterval = (service as any).calculateOptimalInterval(
        extremeLowActivity
      );

      // Assert - Should respect configured bounds
      expect(highActivityInterval).toBeGreaterThanOrEqual(5 * 60 * 1000); // 5 minute minimum
      expect(lowActivityInterval).toBeLessThanOrEqual(30 * 60 * 1000); // 30 minute maximum
    });
  });

  describe('Priority Determination Business Rules', () => {
    it('assigns high priority to categories with many active users', () => {
      // Arrange - Category with high user engagement
      const highUserCategory = {
        userCount: 75, // Above high priority threshold (50)
        avgTemperature: 60,
        dealCount: 100,
      };

      // Act
      const priority = (service as any).determinePriority(highUserCategory);

      // Assert - Should be high priority due to user count
      expect(priority).toBe('high');
    });

    it('assigns high priority to categories with very high temperature', () => {
      // Arrange - Category with exceptional community interest
      const hotCategory = {
        userCount: 20, // Moderate users
        avgTemperature: 250, // Very high temperature (>200 threshold)
        dealCount: 80,
      };

      // Act
      const priority = (service as any).determinePriority(hotCategory);

      // Assert - Should be high priority due to temperature
      expect(priority).toBe('high');
    });

    it('assigns high priority to categories with many deals', () => {
      // Arrange - Category with high deal volume
      const highVolumeCategory = {
        userCount: 30,
        avgTemperature: 70,
        dealCount: 1200, // Above 1000 threshold
      };

      // Act
      const priority = (service as any).determinePriority(highVolumeCategory);

      // Assert - Should be high priority due to deal count
      expect(priority).toBe('high');
    });

    it('assigns low priority to categories with minimal engagement', () => {
      // Arrange - Category with low activity across all metrics
      const lowActivityCategory = {
        userCount: 5, // Below low priority threshold (10)
        avgTemperature: 30, // Below 50 threshold
        dealCount: 50, // Below 100 threshold
      };

      // Act
      const priority = (service as any).determinePriority(lowActivityCategory);

      // Assert - Should be low priority due to all low metrics
      expect(priority).toBe('low');
    });

    it('assigns normal priority to categories with moderate engagement', () => {
      // Arrange - Category with balanced metrics
      const moderateCategory = {
        userCount: 25, // Between thresholds
        avgTemperature: 75, // Moderate temperature
        dealCount: 200, // Moderate deal count
      };

      // Act
      const priority = (service as any).determinePriority(moderateCategory);

      // Assert - Should be normal priority
      expect(priority).toBe('normal');
    });

    it('handles missing category data gracefully with low priority fallback', () => {
      // Act
      const priority = (service as any).determinePriority(null);

      // Assert - Should default to low priority for safety
      expect(priority).toBe('low');
    });
  });

  describe('Schedule Initialization and Management', () => {
    it('initializes scheduling for all active scheduled jobs on startup', async () => {
      // Arrange - Multiple active scheduled jobs
      const activeJobs = [
        createTestScheduledJob({
          id: 'job-1',
          categorySlug: 'gaming-laptops',
          category: createTestCategory({ id: 'cat-init-1', slug: 'gaming-laptops' }),
        }),
        createTestScheduledJob({
          id: 'job-2',
          categorySlug: 'smartphones',
          category: createTestCategory({ id: 'cat-init-2', slug: 'smartphones' }),
        }),
      ];
      mockScheduledJobService.getActiveScheduledJobs.mockResolvedValue(
        activeJobs
      );

      // Act
      await service.initializeScheduling();

      // Assert - Should schedule all active jobs
      expect(mockScheduledJobService.getActiveScheduledJobs).toHaveBeenCalled();
      expect(
        mockScheduledJobService.updateNextScheduledTime
      ).toHaveBeenCalledTimes(2);
    });

    it('updates category schedule when metrics change', async () => {
      // Arrange - Category with updated metrics
      const updatedCategory = createTestCategory({
        slug: 'gaming-laptops',
        userCount: 100, // Increased from 25
        avgTemperature: 120, // Increased temperature
      });
      (mockPrisma.category.findFirst as jest.Mock).mockResolvedValue(updatedCategory);

      // Act
      await service.updateCategorySchedule('gaming-laptops');

      // Assert - Should fetch updated category data
      expect(mockPrisma.category.findFirst).toHaveBeenCalledWith({
        where: { slug: 'gaming-laptops' },
      });
    });

    it('removes schedule for inactive categories', async () => {
      // Arrange - Category that became inactive
      (mockPrisma.category.findFirst as jest.Mock).mockResolvedValue(null);

      // Act
      await service.updateCategorySchedule('inactive-category');

      // Assert - Should handle inactive category gracefully
      expect(mockPrisma.category.findFirst).toHaveBeenCalledWith({
        where: { slug: 'inactive-category' },
      });
    });

    it('removes schedule for categories with no monitoring users', async () => {
      // Arrange - Category with zero users
      const categoryWithNoUsers = createTestCategory({
        userCount: 0,
        isActive: true,
      });
      (mockPrisma.category.findFirst as jest.Mock).mockResolvedValue(categoryWithNoUsers);

      // Act
      await service.updateCategorySchedule('abandoned-category');

      // Assert - Should not schedule categories without users
      expect(mockPrisma.category.findFirst).toHaveBeenCalled();
    });
  });

  describe('Job Triggering and Distribution', () => {
    it('triggers scrape jobs with correct priority and metadata', async () => {
      // Arrange - High-priority category
      const highPriorityCategory = createTestCategory({
        id: 'cat-hp-1',
        slug: 'rtx-4090-deals',
        userCount: 80, // High user count
        avgTemperature: 150,
        dealCount: 800,
      });

      const scheduledJob = createTestScheduledJob({
        id: 'high-priority-job',
        categorySlug: 'rtx-4090-deals',
        optimizedQuery: 'temperatureFrom=95&priceFrom=1000',
      });

      (mockPrisma.category.findUnique as jest.Mock).mockResolvedValue(highPriorityCategory);
      (mockPrisma.scheduledJob.findUnique as jest.Mock).mockResolvedValue(scheduledJob);

      // Act
      await (service as any).triggerScheduledJobScrape(
        'high-priority-job',
        'cat-hp-1'
      );

      // Assert - Should distribute job using multi-site distributor with high priority
      expect(mockMultiSiteDistributor.distributeScrapeJob).toHaveBeenCalledWith(
        'cat-hp-1',
        'rtx-4090-deals',
        'dealabs',
        expect.objectContaining({
          priority: 7, // Mapped priority for high-priority categories
        })
      );
    });

    it('routes job to correct site queue based on category siteId', async () => {
      // Arrange - Category with specific siteId
      const category = createTestCategory({
        id: 'cat-elec-1',
        slug: 'electronics',
        siteId: 'dealabs',
        sourceUrl: 'https://dealabs.com/groupe/electronics',
      });
      const scheduledJob = createTestScheduledJob({
        id: 'optimized-job',
        categorySlug: 'electronics',
      });

      (mockPrisma.category.findUnique as jest.Mock).mockResolvedValue(category);
      (mockPrisma.scheduledJob.findUnique as jest.Mock).mockResolvedValue(scheduledJob);

      // Act
      await (service as any).triggerScheduledJobScrape(
        'optimized-job',
        'cat-elec-1'
      );

      // Assert - Should route to dealabs queue
      expect(mockMultiSiteDistributor.distributeScrapeJob).toHaveBeenCalledWith(
        'cat-elec-1',
        'electronics',
        'dealabs',
        expect.any(Object)
      );
    });

    it('handles categories from different sites correctly', async () => {
      // Arrange - Category from vinted site
      const vintedCategory = createTestCategory({
        id: 'cat-vinted-1',
        slug: 'vintage-clothing',
        siteId: 'vinted',
        sourceUrl: 'https://www.vinted.fr/vetements',
      });
      const scheduledJob = createTestScheduledJob({
        id: 'vinted-job',
        categorySlug: 'vintage-clothing',
      });

      (mockPrisma.category.findUnique as jest.Mock).mockResolvedValue(vintedCategory);
      (mockPrisma.scheduledJob.findUnique as jest.Mock).mockResolvedValue(scheduledJob);

      // Act
      await (service as any).triggerScheduledJobScrape(
        'vinted-job',
        'cat-vinted-1'
      );

      // Assert - Should route to vinted queue
      expect(mockMultiSiteDistributor.distributeScrapeJob).toHaveBeenCalledWith(
        'cat-vinted-1',
        'vintage-clothing',
        'vinted',
        expect.any(Object)
      );
    });

    it('handles job distribution failures gracefully without crashing', async () => {
      // Arrange - Job distributor failure
      mockMultiSiteDistributor.distributeScrapeJob.mockRejectedValue(
        new Error('Queue service unavailable')
      );
      (mockPrisma.category.findUnique as jest.Mock).mockResolvedValue(createTestCategory());
      (mockPrisma.scheduledJob.findUnique as jest.Mock).mockResolvedValue(
        createTestScheduledJob()
      );

      // Act & Assert - Should not throw error
      await expect(
        (service as any).triggerScheduledJobScrape(
          'failing-job',
          'cat-123'
        )
      ).resolves.toBeUndefined();
    });
  });

  describe('System Metrics and Performance Monitoring', () => {
    it('provides comprehensive scheduling metrics for monitoring', async () => {
      // Arrange - System with multiple scheduled categories
      const categoryMetrics = [
        { dealCount: 100, avgTemperature: 80 },
        { dealCount: 200, avgTemperature: 120 },
        { dealCount: 50, avgTemperature: 60 },
      ];
      (mockPrisma.category.findMany as jest.Mock).mockResolvedValue(categoryMetrics);

      // Mock active schedules using mock timer IDs (no real timers)
      const mockTimer1 = 123 as any;
      const mockTimer2 = 456 as any;
      const mockTimer3 = 789 as any;
      (service as any).scheduledJobs = new Map([
        ['category-1', mockTimer1],
        ['category-2', mockTimer2],
        ['category-3', mockTimer3],
      ]);

      // Act
      const metrics = await service.getSchedulingMetrics();

      // Assert - Should provide business-relevant metrics
      expect(metrics).toEqual({
        activeSchedules: 3,
        categoriesMonitored: 3,
        avgEfficiency: expect.any(Number), // Based on average temperature
        avgDealsPerHour: expect.any(Number), // Estimated from deal count and temperature
        lastUpdateTime: expect.any(Date),
      });
    });

    it('handles empty system state gracefully', async () => {
      // Arrange - No active schedules
      (mockPrisma.category.findMany as jest.Mock).mockResolvedValue([]);
      (service as any).scheduledJobs = new Map();

      // Act
      const metrics = await service.getSchedulingMetrics();

      // Assert - Should handle empty state
      expect(metrics).toEqual({
        activeSchedules: 0,
        categoriesMonitored: 0,
        avgEfficiency: 0,
        avgDealsPerHour: 0,
        lastUpdateTime: expect.any(Date),
      });
    });
  });

  describe('System Maintenance and Cleanup', () => {
    it('clears all schedules during system shutdown', () => {
      // Arrange - Mock timers
      const timer1 = setTimeout(() => {}, 1000);
      const timer2 = setTimeout(() => {}, 1000);
      (service as any).scheduledJobs = new Map([
        ['category-1', timer1],
        ['category-2', timer2],
      ]);

      // Act
      service.clearAllSchedules();

      // Assert - Should clear all timers and map
      expect((service as any).scheduledJobs.size).toBe(0);
    });

    it('performs hourly schedule optimization to maintain performance', async () => {
      // Arrange - Active scheduled jobs for optimization with different categories
      const activeJobs = [
        createTestScheduledJob({
          id: 'job-1',
          categorySlug: 'gaming-laptops',
          category: createTestCategory({ id: 'cat-opt-1', slug: 'gaming-laptops' }),
        }),
        createTestScheduledJob({
          id: 'job-2',
          categorySlug: 'smartphones',
          category: createTestCategory({ id: 'cat-opt-2', slug: 'smartphones' }),
        }),
      ];
      mockScheduledJobService.getActiveScheduledJobs.mockResolvedValue(
        activeJobs
      );

      // Act
      await service.optimizeSchedules();

      // Assert - Should re-schedule all active jobs
      expect(mockScheduledJobService.getActiveScheduledJobs).toHaveBeenCalled();
      expect(
        mockScheduledJobService.updateNextScheduledTime
      ).toHaveBeenCalledTimes(2);
    });
  });

  describe('Business Edge Cases and Error Handling', () => {
    it('handles safe numeric conversion for invalid temperature values', () => {
      // Act
      const resultNull = (service as any).safeNumber(null, 50);
      const resultUndefined = (service as any).safeNumber(undefined, 50);
      const resultNaN = (service as any).safeNumber(NaN, 50);
      const resultValid = (service as any).safeNumber(75, 50);

      // Assert - Should use fallback for invalid values
      expect(resultNull).toBe(50);
      expect(resultUndefined).toBe(50);
      expect(resultNaN).toBe(50);
      expect(resultValid).toBe(75);
    });

    it('correctly identifies hot categories based on temperature threshold', () => {
      // Act
      const hotCategory = (service as any).isCategoryHot(120); // Above 100 threshold
      const coolCategory = (service as any).isCategoryHot(80); // Below threshold
      const nullTemperature = (service as any).isCategoryHot(null);

      // Assert
      expect(hotCategory).toBe(true);
      expect(coolCategory).toBe(false);
      expect(nullTemperature).toBe(false);
    });

    it('calculates user factor with proper bounds to prevent extreme intervals', () => {
      // Act
      const lowUserFactor = (service as any).calculateUserFactor(5); // Few users
      const highUserFactor = (service as any).calculateUserFactor(200); // Many users
      const extremeUserFactor = (service as any).calculateUserFactor(1000); // Extreme case

      // Assert - Should respect minimum factor bound
      expect(lowUserFactor).toBeGreaterThan(0.8); // High multiplier (longer interval)
      expect(highUserFactor).toBeLessThan(0.5); // Low multiplier (shorter interval)
      expect(extremeUserFactor).toBeGreaterThanOrEqual(0.3); // Minimum bound
    });

    it('calculates deal count factor based on activity thresholds', () => {
      // Act
      const lowActivityFactor = (service as any).calculateDealCountFactor(100); // Low deal count
      const highActivityFactor = (service as any).calculateDealCountFactor(
        5000
      ); // High deal count
      const veryLowActivityFactor = (service as any).calculateDealCountFactor(
        10
      ); // Very low

      // Assert - Should apply appropriate multipliers
      expect(veryLowActivityFactor).toBeGreaterThan(1); // Longer interval for low activity
      expect(highActivityFactor).toBeLessThan(1); // Shorter interval for high activity
      expect(lowActivityFactor).toBeGreaterThan(highActivityFactor);
    });
  });
});
