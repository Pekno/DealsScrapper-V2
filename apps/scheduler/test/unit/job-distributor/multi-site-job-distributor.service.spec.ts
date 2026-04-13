import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { SiteSource, getSiteQueueName } from '@dealscrapper/shared-types';
import { MultiSiteJobDistributorService, QueueStats } from '../../../src/job-distributor/multi-site-job-distributor.service';

describe('MultiSiteJobDistributorService', () => {
  let service: MultiSiteJobDistributorService;
  let dealabsQueue: jest.Mocked<Queue>;
  let vintedQueue: jest.Mocked<Queue>;
  let leboncoinQueue: jest.Mocked<Queue>;

  beforeEach(async () => {
    // Create mock queues
    const createMockQueue = (): jest.Mocked<Queue> => ({
      add: jest.fn(),
      getWaitingCount: jest.fn().mockResolvedValue(0),
      getActiveCount: jest.fn().mockResolvedValue(0),
      getCompletedCount: jest.fn().mockResolvedValue(0),
      getFailedCount: jest.fn().mockResolvedValue(0),
      getWaiting: jest.fn().mockResolvedValue([]),
      getActive: jest.fn().mockResolvedValue([]),
      getDelayed: jest.fn().mockResolvedValue([]),
      empty: jest.fn().mockResolvedValue(undefined),
      pause: jest.fn().mockResolvedValue(undefined),
      resume: jest.fn().mockResolvedValue(undefined),
    } as any);

    dealabsQueue = createMockQueue();
    vintedQueue = createMockQueue();
    leboncoinQueue = createMockQueue();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MultiSiteJobDistributorService,
        {
          provide: getQueueToken(getSiteQueueName(SiteSource.DEALABS)),
          useValue: dealabsQueue,
        },
        {
          provide: getQueueToken(getSiteQueueName(SiteSource.VINTED)),
          useValue: vintedQueue,
        },
        {
          provide: getQueueToken(getSiteQueueName(SiteSource.LEBONCOIN)),
          useValue: leboncoinQueue,
        },
      ],
    }).compile();

    service = module.get<MultiSiteJobDistributorService>(MultiSiteJobDistributorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('distributeScrapeJob', () => {
    it('should route job to Dealabs queue', async () => {
      const mockJob = { id: 'job-1', data: { categoryId: 'cat-1', categorySlug: 'test-category' } } as Job;
      dealabsQueue.add.mockResolvedValue(mockJob as any);

      const result = await service.distributeScrapeJob('cat-1', 'test-category', SiteSource.DEALABS);

      expect(result).toBe(mockJob);
      expect(dealabsQueue.add).toHaveBeenCalledWith(
        'scrape',
        expect.objectContaining({
          type: 'scrape-category',
          categoryId: 'cat-1',
          categorySlug: 'test-category',
          source: SiteSource.DEALABS,
        }),
        expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        })
      );
      expect(vintedQueue.add).not.toHaveBeenCalled();
      expect(leboncoinQueue.add).not.toHaveBeenCalled();
    });

    it('should route job to Vinted queue', async () => {
      const mockJob = { id: 'job-2', data: { categoryId: 'cat-2', categorySlug: 'vinted-category' } } as Job;
      vintedQueue.add.mockResolvedValue(mockJob as any);

      const result = await service.distributeScrapeJob('cat-2', 'vinted-category', SiteSource.VINTED);

      expect(result).toBe(mockJob);
      expect(vintedQueue.add).toHaveBeenCalledWith(
        'scrape',
        expect.objectContaining({
          categoryId: 'cat-2',
          categorySlug: 'vinted-category',
          source: SiteSource.VINTED,
        }),
        expect.any(Object)
      );
      expect(dealabsQueue.add).not.toHaveBeenCalled();
      expect(leboncoinQueue.add).not.toHaveBeenCalled();
    });

    it('should route job to LeBonCoin queue', async () => {
      const mockJob = { id: 'job-3', data: { categoryId: 'cat-3', categorySlug: 'leboncoin-category' } } as Job;
      leboncoinQueue.add.mockResolvedValue(mockJob as any);

      const result = await service.distributeScrapeJob('cat-3', 'leboncoin-category', SiteSource.LEBONCOIN);

      expect(result).toBe(mockJob);
      expect(leboncoinQueue.add).toHaveBeenCalledWith(
        'scrape',
        expect.objectContaining({
          categoryId: 'cat-3',
          categorySlug: 'leboncoin-category',
          source: SiteSource.LEBONCOIN,
        }),
        expect.any(Object)
      );
      expect(dealabsQueue.add).not.toHaveBeenCalled();
      expect(vintedQueue.add).not.toHaveBeenCalled();
    });

    it('should skip creating duplicate job if one already exists', async () => {
      const existingJob = {
        id: 'existing-job',
        data: { categoryId: 'cat-1', categorySlug: 'test-category' },
      } as Job;

      dealabsQueue.getWaiting.mockResolvedValue([existingJob as any]);

      const result = await service.distributeScrapeJob('cat-1', 'test-category', SiteSource.DEALABS);

      expect(result).toBeNull();
      expect(dealabsQueue.add).not.toHaveBeenCalled();
    });

    it('should respect custom priority and attempts', async () => {
      const mockJob = { id: 'job-4' } as Job;
      dealabsQueue.add.mockResolvedValue(mockJob as any);

      await service.distributeScrapeJob('cat-4', 'test-category', SiteSource.DEALABS, {
        priority: 10,
        attempts: 5,
      });

      expect(dealabsQueue.add).toHaveBeenCalledWith(
        'scrape',
        expect.any(Object),
        expect.objectContaining({
          priority: 10,
          attempts: 5,
        })
      );
    });

    it('should throw error for invalid siteId', async () => {
      await expect(
        service.distributeScrapeJob('cat-1', 'test-category', 'invalid-site' as any)
      ).rejects.toThrow('No queue configured for site: invalid-site');
    });
  });

  describe('getQueueStats', () => {
    it('should return stats for Dealabs queue', async () => {
      dealabsQueue.getWaitingCount.mockResolvedValue(5);
      dealabsQueue.getActiveCount.mockResolvedValue(2);
      dealabsQueue.getCompletedCount.mockResolvedValue(100);
      dealabsQueue.getFailedCount.mockResolvedValue(3);

      const stats = await service.getQueueStats(SiteSource.DEALABS);

      expect(stats).toEqual({
        site: SiteSource.DEALABS,
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
      });
    });

    it('should return stats for Vinted queue', async () => {
      vintedQueue.getWaitingCount.mockResolvedValue(3);
      vintedQueue.getActiveCount.mockResolvedValue(1);
      vintedQueue.getCompletedCount.mockResolvedValue(50);
      vintedQueue.getFailedCount.mockResolvedValue(2);

      const stats = await service.getQueueStats(SiteSource.VINTED);

      expect(stats).toEqual({
        site: SiteSource.VINTED,
        waiting: 3,
        active: 1,
        completed: 50,
        failed: 2,
      });
    });

    it('should throw error for invalid siteId', async () => {
      await expect(
        service.getQueueStats('invalid-site' as any)
      ).rejects.toThrow('No queue configured for site: invalid-site');
    });
  });

  describe('getAllQueuesStats', () => {
    it('should return stats for all queues', async () => {
      dealabsQueue.getWaitingCount.mockResolvedValue(5);
      dealabsQueue.getActiveCount.mockResolvedValue(2);
      dealabsQueue.getCompletedCount.mockResolvedValue(100);
      dealabsQueue.getFailedCount.mockResolvedValue(3);

      vintedQueue.getWaitingCount.mockResolvedValue(3);
      vintedQueue.getActiveCount.mockResolvedValue(1);
      vintedQueue.getCompletedCount.mockResolvedValue(50);
      vintedQueue.getFailedCount.mockResolvedValue(2);

      leboncoinQueue.getWaitingCount.mockResolvedValue(1);
      leboncoinQueue.getActiveCount.mockResolvedValue(0);
      leboncoinQueue.getCompletedCount.mockResolvedValue(25);
      leboncoinQueue.getFailedCount.mockResolvedValue(1);

      const allStats = await service.getAllQueuesStats();

      expect(allStats).toHaveLength(3);
      expect(allStats).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ site: SiteSource.DEALABS, waiting: 5 }),
          expect.objectContaining({ site: SiteSource.VINTED, waiting: 3 }),
          expect.objectContaining({ site: SiteSource.LEBONCOIN, waiting: 1 }),
        ])
      );
    });
  });

  describe('Queue isolation', () => {
    it('should maintain isolation between queues', async () => {
      const dealabsJob = { id: 'dealabs-1' } as Job;
      const vintedJob = { id: 'vinted-1' } as Job;

      dealabsQueue.add.mockResolvedValue(dealabsJob as any);
      vintedQueue.add.mockResolvedValue(vintedJob as any);

      // Create jobs in different queues
      await service.distributeScrapeJob('cat-d1', 'category-1', SiteSource.DEALABS);
      await service.distributeScrapeJob('cat-v1', 'category-2', SiteSource.VINTED);

      // Verify each queue only received its own job
      expect(dealabsQueue.add).toHaveBeenCalledTimes(1);
      expect(vintedQueue.add).toHaveBeenCalledTimes(1);
      expect(leboncoinQueue.add).not.toHaveBeenCalled();

      // Verify jobs are isolated
      expect(dealabsQueue.add).toHaveBeenCalledWith(
        'scrape',
        expect.objectContaining({ source: SiteSource.DEALABS }),
        expect.any(Object)
      );
      expect(vintedQueue.add).toHaveBeenCalledWith(
        'scrape',
        expect.objectContaining({ source: SiteSource.VINTED }),
        expect.any(Object)
      );
    });
  });

  describe('Queue management', () => {
    it('should pause a queue', async () => {
      await service.pauseQueue(SiteSource.DEALABS);
      expect(dealabsQueue.pause).toHaveBeenCalled();
    });

    it('should resume a queue', async () => {
      await service.resumeQueue(SiteSource.VINTED);
      expect(vintedQueue.resume).toHaveBeenCalled();
    });

    it('should clear a queue', async () => {
      await service.clearQueue(SiteSource.LEBONCOIN);
      expect(leboncoinQueue.empty).toHaveBeenCalled();
    });
  });
});
