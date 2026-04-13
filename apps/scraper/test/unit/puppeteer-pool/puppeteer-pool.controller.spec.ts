import { Test, TestingModule } from '@nestjs/testing';
import { PuppeteerPoolController } from '../../../src/puppeteer-pool/puppeteer-pool.controller';
import { PuppeteerPoolService } from '../../../src/puppeteer-pool/puppeteer-pool.service';
import { PoolStats } from '../../../src/puppeteer-pool/puppeteer-pool.service';
import { StandardApiResponse } from '@dealscrapper/shared-types';

describe('PuppeteerPoolController - Browser Infrastructure Monitoring', () => {
  let controller: PuppeteerPoolController;
  let puppeteerPoolService: jest.Mocked<PuppeteerPoolService>;

  const mockPoolStats: PoolStats = {
    totalInstances: 5,
    busyInstances: 3,
    availableInstances: 2,
    queueLength: 1,
    totalRequests: 200,
    avgWaitTime: 250,
    queuedRequests: 1,
    successfulRequests: 150,
    failedRequests: 5,
    healthStatus: 'healthy',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PuppeteerPoolController],
      providers: [
        {
          provide: PuppeteerPoolService,
          useValue: {
            getStats: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PuppeteerPoolController>(PuppeteerPoolController);
    puppeteerPoolService = module.get(PuppeteerPoolService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Browser Infrastructure Health Monitoring', () => {
    it('should provide real-time infrastructure metrics for operational visibility', () => {
      // Arrange
      puppeteerPoolService.getStats.mockReturnValue(mockPoolStats);

      // Act
      const result = controller.getPoolStats();

      // Business value: Operations team can monitor browser infrastructure health
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPoolStats);
      expect(result.data!.totalInstances).toBe(5); // Infrastructure capacity
      expect(result.data!.busyInstances).toBe(3); // Active deal discovery
      expect(result.data!.availableInstances).toBe(2); // Available for new requests
      expect(result.data!.healthStatus).toBe('healthy'); // Service is operational
      expect(puppeteerPoolService.getStats).toHaveBeenCalledTimes(1);
    });

    it('should track infrastructure utilization changes over time', () => {
      // Arrange
      const updatedStats: PoolStats = {
        ...mockPoolStats,
        busyInstances: 4,
        availableInstances: 1,
        totalRequests: 175,
        queueLength: 0,
        avgWaitTime: 200,
      };

      puppeteerPoolService.getStats
        .mockReturnValueOnce(mockPoolStats)
        .mockReturnValueOnce(updatedStats);

      // Act
      const firstResult = controller.getPoolStats();
      const secondResult = controller.getPoolStats();

      // Business outcome: Real-time tracking shows infrastructure performance trends
      expect(firstResult.success).toBe(true);
      expect(secondResult.success).toBe(true);
      expect(firstResult.data).toEqual(mockPoolStats);
      expect(secondResult.data).toEqual(updatedStats);
      expect(secondResult.data!.avgWaitTime).toBeLessThan(
        firstResult.data!.avgWaitTime
      ); // Performance improving
      expect(puppeteerPoolService.getStats).toHaveBeenCalledTimes(2);
    });

    it('should handle service initialization states gracefully', () => {
      // Arrange
      const emptyStats: PoolStats = {
        totalInstances: 0,
        busyInstances: 0,
        availableInstances: 0,
        queueLength: 0,
        totalRequests: 0,
        avgWaitTime: 0,
        queuedRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        healthStatus: 'degraded' as const,
      };

      puppeteerPoolService.getStats.mockReturnValue(emptyStats);

      // Act
      const result = controller.getPoolStats();

      // Business behavior: Service provides visibility even during startup
      expect(result.success).toBe(true);
      expect(result.data).toEqual(emptyStats);
      expect(result.data!.healthStatus).toBe('degraded');
    });
  });
});
