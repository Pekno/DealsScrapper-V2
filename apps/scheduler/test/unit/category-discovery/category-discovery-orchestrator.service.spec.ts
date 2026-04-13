import { Test, TestingModule } from '@nestjs/testing';
import { CategoryDiscoveryOrchestrator } from '../../../src/category-discovery/category-discovery-orchestrator.service';
import { MultiSiteJobDistributorService } from '../../../src/job-distributor/multi-site-job-distributor.service';
import { SiteSource } from '@dealscrapper/shared-types';

describe('CategoryDiscoveryOrchestrator Business Logic', () => {
  let service: CategoryDiscoveryOrchestrator;
  let mockJobDistributor: jest.Mocked<MultiSiteJobDistributorService>;

  beforeEach(async () => {
    // Mock MultiSiteJobDistributorService
    mockJobDistributor = {
      distributeDiscoveryJob: jest.fn(),
      getAllQueuesStats: jest.fn().mockResolvedValue([
        { site: SiteSource.DEALABS, waiting: 0, active: 0, completed: 0, failed: 0 },
        { site: SiteSource.VINTED, waiting: 0, active: 0, completed: 0, failed: 0 },
        { site: SiteSource.LEBONCOIN, waiting: 0, active: 0, completed: 0, failed: 0 },
      ]),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryDiscoveryOrchestrator,
        {
          provide: MultiSiteJobDistributorService,
          useValue: mockJobDistributor,
        },
      ],
    }).compile();

    service = module.get<CategoryDiscoveryOrchestrator>(
      CategoryDiscoveryOrchestrator
    );
  });

  describe('Daily Scheduled Discovery', () => {
    it('schedules discovery jobs for all sites at 2 AM daily', async () => {
      // Arrange
      let jobCounter = 0;
      mockJobDistributor.distributeDiscoveryJob.mockImplementation(() => {
        jobCounter++;
        return Promise.resolve({ id: `discovery-job-${jobCounter}` } as any);
      });

      // Act
      await service.scheduleDailyCategoryDiscovery();

      // Assert - Should queue discovery job for each site
      const sites = Object.values(SiteSource);
      expect(mockJobDistributor.distributeDiscoveryJob).toHaveBeenCalledTimes(sites.length);

      // Verify each site gets scheduled with correct parameters
      for (const site of sites) {
        expect(mockJobDistributor.distributeDiscoveryJob).toHaveBeenCalledWith(
          site,
          'daily-cron',
          expect.objectContaining({ priority: 1 })
        );
      }
    });

    it('handles daily discovery job failures gracefully for individual sites', async () => {
      // Arrange - First site fails, others succeed
      mockJobDistributor.distributeDiscoveryJob
        .mockRejectedValueOnce(new Error('Queue service unavailable'))
        .mockResolvedValueOnce({ id: 'job-2' } as any)
        .mockResolvedValueOnce({ id: 'job-3' } as any);

      // Act & Assert - Should not throw error, continues with other sites
      await expect(
        service.scheduleDailyCategoryDiscovery()
      ).resolves.toBeUndefined();

      // Should have attempted all sites
      expect(mockJobDistributor.distributeDiscoveryJob).toHaveBeenCalledTimes(3);
    });

    it('handles all daily discovery jobs failing gracefully', async () => {
      // Arrange - All sites fail
      mockJobDistributor.distributeDiscoveryJob.mockRejectedValue(
        new Error('Queue service unavailable')
      );

      // Act & Assert - Should not throw error
      await expect(
        service.scheduleDailyCategoryDiscovery()
      ).resolves.toBeUndefined();
    });
  });

  describe('Manual Discovery Triggering', () => {
    it('triggers discovery for specific site on demand', async () => {
      // Arrange
      const mockJob = { id: 'manual-discovery-456' };
      mockJobDistributor.distributeDiscoveryJob.mockResolvedValue(mockJob as any);

      // Act - Trigger for specific site
      const result = await service.triggerManualDiscovery('manual-api', SiteSource.DEALABS);

      // Assert - Should queue discovery for ONE site with high priority
      expect(mockJobDistributor.distributeDiscoveryJob).toHaveBeenCalledTimes(1);
      expect(mockJobDistributor.distributeDiscoveryJob).toHaveBeenCalledWith(
        SiteSource.DEALABS,
        'manual-api',
        expect.objectContaining({ priority: 10 })
      );
      expect(result).toEqual({
        success: true,
        jobId: 'manual-discovery-456',
        message: `Manual category discovery job queued for ${SiteSource.DEALABS}`,
      });
    });

    it('triggers discovery for all sites when no siteId provided', async () => {
      // Arrange
      let jobCounter = 0;
      mockJobDistributor.distributeDiscoveryJob.mockImplementation(() => {
        jobCounter++;
        return Promise.resolve({ id: `job-${jobCounter}` } as any);
      });

      // Act - Trigger without specific site
      const result = await service.triggerManualDiscovery('manual-api');

      // Assert - Should queue for all sites
      const sites = Object.values(SiteSource);
      expect(mockJobDistributor.distributeDiscoveryJob).toHaveBeenCalledTimes(sites.length);
      expect(result.success).toBe(true);
      expect(result.jobIds).toHaveLength(sites.length);
      expect(result.message).toContain(`${sites.length}/${sites.length}`);
    });

    it('returns error result when single site manual discovery fails', async () => {
      // Arrange
      mockJobDistributor.distributeDiscoveryJob.mockRejectedValue(
        new Error('Worker capacity exceeded')
      );

      // Act
      const result = await service.triggerManualDiscovery('manual-api', SiteSource.DEALABS);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Worker capacity exceeded',
        message: `Failed to queue manual category discovery job for ${SiteSource.DEALABS}`,
      });
    });

    it('returns partial success when some sites fail in multi-site discovery', async () => {
      // Arrange - First fails, others succeed
      mockJobDistributor.distributeDiscoveryJob
        .mockRejectedValueOnce(new Error('Site unavailable'))
        .mockResolvedValueOnce({ id: 'job-2' } as any)
        .mockResolvedValueOnce({ id: 'job-3' } as any);

      // Act
      const result = await service.triggerManualDiscovery('manual-api');

      // Assert - Partial success
      expect(result.success).toBe(true);
      expect(result.jobIds).toHaveLength(2);
      expect(result.error).toContain('Site unavailable');
    });

    it('returns error when all sites fail in multi-site discovery', async () => {
      // Arrange - All fail
      mockJobDistributor.distributeDiscoveryJob.mockRejectedValue(
        new Error('Queue unavailable')
      );

      // Act
      const result = await service.triggerManualDiscovery('manual-api');

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('all sites');
    });
  });

  describe('Discovery Status Monitoring', () => {
    it('provides comprehensive discovery status from all site queues', async () => {
      // Arrange - Mock queue statistics per site
      mockJobDistributor.getAllQueuesStats.mockResolvedValue([
        { site: SiteSource.DEALABS, waiting: 1, active: 1, completed: 5, failed: 0 },
        { site: SiteSource.VINTED, waiting: 1, active: 0, completed: 5, failed: 1 },
        { site: SiteSource.LEBONCOIN, waiting: 0, active: 0, completed: 5, failed: 0 },
      ]);

      // Act
      const status = await service.getDiscoveryStatus();

      // Assert - Should aggregate stats from all queues
      expect(status).toEqual({
        queueStatus: {
          waiting: 2,
          active: 1,
          completed: 15,
          failed: 1,
        },
        discoveryJobs: {
          pending: 2,
          processing: 1,
        },
        perSiteStatus: expect.arrayContaining([
          expect.objectContaining({ site: SiteSource.DEALABS }),
          expect.objectContaining({ site: SiteSource.VINTED }),
          expect.objectContaining({ site: SiteSource.LEBONCOIN }),
        ]),
        lastUpdate: expect.any(Date),
        systemStatus: 'operational',
      });
    });

    it('detects degraded system status from queue issues', async () => {
      // Arrange - Mock unhealthy queue state (failed jobs, no active processing)
      mockJobDistributor.getAllQueuesStats.mockResolvedValue([
        { site: SiteSource.DEALABS, waiting: 0, active: 0, completed: 0, failed: 5 },
        { site: SiteSource.VINTED, waiting: 0, active: 0, completed: 0, failed: 0 },
        { site: SiteSource.LEBONCOIN, waiting: 0, active: 0, completed: 0, failed: 0 },
      ]);

      // Act
      const status = await service.getDiscoveryStatus();

      // Assert - Should detect degraded status
      expect(status.systemStatus).toBe('degraded');
    });

    it('handles queue statistics errors gracefully', async () => {
      // Arrange
      mockJobDistributor.getAllQueuesStats.mockRejectedValue(
        new Error('Queue connection lost')
      );

      // Act
      const status = await service.getDiscoveryStatus();

      // Assert - Should return error status
      expect(status).toEqual({
        queueStatus: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
        },
        discoveryJobs: {
          pending: 0,
          processing: 0,
        },
        perSiteStatus: [],
        lastUpdate: expect.any(Date),
        systemStatus: 'error',
        error: 'Queue connection lost',
      });
    });
  });

  describe('Business Scenarios', () => {
    it('handles high-frequency manual discovery requests for specific sites', async () => {
      // Arrange - Multiple rapid manual requests for same site
      const mockJobs = [{ id: 'job-1' }, { id: 'job-2' }, { id: 'job-3' }];
      mockJobDistributor.distributeDiscoveryJob
        .mockResolvedValueOnce(mockJobs[0] as any)
        .mockResolvedValueOnce(mockJobs[1] as any)
        .mockResolvedValueOnce(mockJobs[2] as any);

      // Act - Simulate rapid requests for specific site
      const results = await Promise.all([
        service.triggerManualDiscovery('api-1', SiteSource.DEALABS),
        service.triggerManualDiscovery('api-2', SiteSource.DEALABS),
        service.triggerManualDiscovery('api-3', SiteSource.DEALABS),
      ]);

      // Assert - All should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.jobId).toBe(mockJobs[index].id);
      });
      expect(mockJobDistributor.distributeDiscoveryJob).toHaveBeenCalledTimes(3);
    });

    it('coordinates with daily scheduled discovery', async () => {
      // Arrange - Daily scheduled discovery and manual trigger around same time
      let jobCounter = 0;
      mockJobDistributor.distributeDiscoveryJob.mockImplementation(() => {
        jobCounter++;
        return Promise.resolve({ id: `job-${jobCounter}` } as any);
      });

      // Act - Daily discovery (3 sites) then manual discovery (1 site)
      await service.scheduleDailyCategoryDiscovery();
      const manualResult = await service.triggerManualDiscovery('manual-api', SiteSource.DEALABS);

      // Assert - Daily: 3 calls, Manual: 1 call
      expect(mockJobDistributor.distributeDiscoveryJob).toHaveBeenCalledTimes(4);

      // Daily jobs should have low priority (1)
      const dailyCalls = mockJobDistributor.distributeDiscoveryJob.mock.calls.slice(0, 3);
      dailyCalls.forEach(call => {
        expect(call[2]).toEqual(expect.objectContaining({ priority: 1 }));
      });

      // Manual job should have high priority (10)
      const manualCall = mockJobDistributor.distributeDiscoveryJob.mock.calls[3];
      expect(manualCall[2]).toEqual(expect.objectContaining({ priority: 10 }));
      expect(manualResult.success).toBe(true);
    });

    it('monitors discovery performance for operations team', async () => {
      // Arrange - Simulated production queue state
      mockJobDistributor.getAllQueuesStats.mockResolvedValue([
        { site: SiteSource.DEALABS, waiting: 5, active: 2, completed: 70, failed: 3 },
        { site: SiteSource.VINTED, waiting: 5, active: 2, completed: 65, failed: 4 },
        { site: SiteSource.LEBONCOIN, waiting: 5, active: 1, completed: 65, failed: 3 },
      ]);

      // Act
      const status = await service.getDiscoveryStatus();

      // Assert - Should provide operational insights
      expect(status).toMatchObject({
        queueStatus: {
          waiting: 15,
          active: 5,
          completed: 200,
          failed: 10,
        },
        discoveryJobs: {
          pending: expect.any(Number),
          processing: expect.any(Number),
        },
        systemStatus: expect.any(String),
      });
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('continues operating when job distributor is temporarily unavailable', async () => {
      // Arrange - Service temporarily unavailable
      mockJobDistributor.distributeDiscoveryJob
        .mockRejectedValueOnce(new Error('Service temporarily unavailable'))
        .mockResolvedValueOnce({ id: 'recovered-job' } as any);

      // Act - First attempt fails, second succeeds (both for specific site)
      const failedResult = await service.triggerManualDiscovery('test', SiteSource.DEALABS);
      const successResult = await service.triggerManualDiscovery('test', SiteSource.DEALABS);

      // Assert - Should handle failure gracefully and recover
      expect(failedResult.success).toBe(false);
      expect(successResult.success).toBe(true);
    });

    it('provides meaningful error information for debugging', async () => {
      // Arrange - Specific error scenarios
      mockJobDistributor.distributeDiscoveryJob.mockRejectedValue(
        new Error('Maximum queue size exceeded: 1000 jobs')
      );

      // Act
      const result = await service.triggerManualDiscovery('test', SiteSource.DEALABS);

      // Assert - Should include specific error details
      expect(result).toEqual({
        success: false,
        error: 'Maximum queue size exceeded: 1000 jobs',
        message: `Failed to queue manual category discovery job for ${SiteSource.DEALABS}`,
      });
    });
  });

  describe('Site-Specific Discovery', () => {
    it('discovers categories for Vinted site', async () => {
      // Arrange
      const mockJob = { id: 'vinted-discovery' };
      mockJobDistributor.distributeDiscoveryJob.mockResolvedValue(mockJob as any);

      // Act
      const result = await service.triggerManualDiscovery('test', SiteSource.VINTED);

      // Assert
      expect(mockJobDistributor.distributeDiscoveryJob).toHaveBeenCalledWith(
        SiteSource.VINTED,
        'test',
        expect.objectContaining({ priority: 10 })
      );
      expect(result.success).toBe(true);
    });

    it('discovers categories for LeBonCoin site', async () => {
      // Arrange
      const mockJob = { id: 'leboncoin-discovery' };
      mockJobDistributor.distributeDiscoveryJob.mockResolvedValue(mockJob as any);

      // Act
      const result = await service.triggerManualDiscovery('test', SiteSource.LEBONCOIN);

      // Assert
      expect(mockJobDistributor.distributeDiscoveryJob).toHaveBeenCalledWith(
        SiteSource.LEBONCOIN,
        'test',
        expect.objectContaining({ priority: 10 })
      );
      expect(result.success).toBe(true);
    });
  });
});
