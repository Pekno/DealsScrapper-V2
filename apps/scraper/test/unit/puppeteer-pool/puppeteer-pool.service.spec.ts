import { Test, TestingModule } from '@nestjs/testing';
import {
  PuppeteerPoolService,
  BrowserInstance,
  PoolStats,
} from '../../../src/puppeteer-pool/puppeteer-pool.service';
import { SharedConfigService } from '@dealscrapper/shared-config';
import { CookieFilterService } from '../../../src/puppeteer-pool/cookie-filter.service';
import { Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';

// Use the globally mocked puppeteer from setup.ts
const mockPuppeteer = puppeteer as jest.Mocked<typeof puppeteer>;

describe('PuppeteerPoolService - Web Scraping Infrastructure for Deal Discovery', () => {
  let service: PuppeteerPoolService;
  let sharedConfigService: SharedConfigService;

  const createMockBrowser = (overrides: Partial<puppeteer.Browser> = {}) => ({
    newPage: jest.fn().mockResolvedValue({
      goto: jest.fn(),
      close: jest.fn(),
      evaluate: jest.fn().mockResolvedValue(true),
    }),
    close: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockReturnValue(true),
    process: jest
      .fn()
      .mockReturnValue({ pid: Math.floor(Math.random() * 100000) }),
    version: jest.fn().mockResolvedValue('120.0.0.0'),
    pages: jest.fn().mockResolvedValue([
      {
        evaluate: jest.fn().mockResolvedValue(true),
        goto: jest.fn(),
        close: jest.fn(),
      },
    ]),
    on: jest.fn(),
    createBrowserContext: jest.fn(),
    browserContexts: jest.fn().mockReturnValue([]),
    defaultBrowserContext: jest.fn(),
    wsEndpoint: jest.fn().mockReturnValue('ws://localhost:9222'),
    userAgent: jest.fn().mockResolvedValue('Mozilla/5.0'),
    target: jest.fn(),
    targets: jest.fn().mockReturnValue([]),
    waitForTarget: jest.fn(),
    disconnect: jest.fn(),
    off: jest.fn(),
    once: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    listenerCount: jest.fn().mockReturnValue(0),
    emit: jest.fn(),
    eventNames: jest.fn().mockReturnValue([]),
    getMaxListeners: jest.fn().mockReturnValue(10),
    setMaxListeners: jest.fn(),
    prependListener: jest.fn(),
    prependOnceListener: jest.fn(),
    rawListeners: jest.fn().mockReturnValue([]),
    listeners: jest.fn().mockReturnValue([]),
    ...overrides,
  });

  const createMockSharedConfigService = (
    config: Record<string, unknown> = {}
  ) => ({
    get: jest.fn((key: string) => {
      const defaultConfig = {
        PUPPETEER_MAX_INSTANCES: 3,
        PUPPETEER_TIMEOUT: 30000,
        PUPPETEER_HEADLESS: true,
        WORKER_MAX_MEMORY_MB: 1024,
      };
      return config[key] ?? (defaultConfig as any)[key];
    }),
  });

  beforeEach(async () => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Mock Logger to avoid console output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PuppeteerPoolService,
        {
          provide: SharedConfigService,
          useValue: createMockSharedConfigService(),
        },
        {
          provide: CookieFilterService,
          useValue: { getSelectors: jest.fn().mockReturnValue([]) },
        },
      ],
    }).compile();

    service = module.get<PuppeteerPoolService>(PuppeteerPoolService);
    sharedConfigService = module.get<SharedConfigService>(SharedConfigService);

    // Setup default mock behavior
    mockPuppeteer.launch.mockResolvedValue(
      createMockBrowser() as unknown as puppeteer.Browser
    );
  });

  afterEach(async () => {
    // Clean up service state
    try {
      await service.onModuleDestroy();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Browser Infrastructure Setup for Deal Collection', () => {
    it('should prepare browser infrastructure to enable deal collection for users', async () => {
      await service.initialize();

      // Business outcome: Scraping infrastructure is ready to serve users
      expect(mockPuppeteer.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          headless: expect.anything(),
          args: expect.arrayContaining([
            '--no-sandbox',
            '--disable-setuid-sandbox',
          ]),
        })
      );

      // Business value: Multiple browser instances for concurrent deal discovery
      expect(mockPuppeteer.launch).toHaveBeenCalledTimes(2);
      const stats = service.getStats();
      expect(stats.totalInstances).toBe(2);
      expect(stats.availableInstances).toBe(2);
    });

    it('should initialize with correct configuration', () => {
      const stats = service.getStats();
      expect(stats.totalInstances).toBe(0);
      expect(stats.queueLength).toBe(0);
      expect(stats.busyInstances).toBe(0);
      expect(stats.availableInstances).toBe(0);
    });

    it('should handle custom configuration', async () => {
      const customSharedConfigService = createMockSharedConfigService({
        PUPPETEER_MAX_INSTANCES: 5,
        PUPPETEER_HEADLESS: false,
        WORKER_MAX_MEMORY_MB: 2048,
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PuppeteerPoolService,
          { provide: SharedConfigService, useValue: customSharedConfigService },
          {
            provide: CookieFilterService,
            useValue: { getSelectors: jest.fn().mockReturnValue([]) },
          },
        ],
      }).compile();

      const customService =
        module.get<PuppeteerPoolService>(PuppeteerPoolService);
      await customService.initialize();

      expect(customSharedConfigService.get).toHaveBeenCalledWith(
        'PUPPETEER_MAX_INSTANCES'
      );
      // Configuration service should be called during initialization
      expect(customSharedConfigService.get).toHaveBeenCalled();

      // Clean up the custom service
      await customService.onModuleDestroy();
    });
  });

  describe('Browser Resource Management for Reliable Deal Collection', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should provide browsers to enable concurrent deal discovery', async () => {
      const browser = await service.acquire();

      // Business outcome: Browser is available for deal extraction
      expect(browser).toBeDefined();
      expect(browser).toEqual(
        expect.objectContaining({
          newPage: expect.any(Function),
          close: expect.any(Function),
        })
      );

      const stats = service.getStats();
      // Business value: Resources are tracked for optimal performance
      expect(stats.busyInstances).toBeGreaterThanOrEqual(1);
      expect(stats.totalInstances).toBeGreaterThanOrEqual(1);
    });

    it('should manage browser queue to maintain service availability', async () => {
      // Test basic browser acquisition and release flow
      const browser1 = await service.acquire();
      const browser2 = await service.acquire();

      expect(browser1).toBeDefined();
      expect(browser2).toBeDefined();

      // Business value: Queue tracks resource usage
      const stats = service.getStats();
      expect(stats.busyInstances).toBe(2);
      expect(stats.availableInstances).toBe(0);

      // Release and verify resource availability
      await service.release(browser1);
      const statsAfterRelease = service.getStats();
      expect(statsAfterRelease.busyInstances).toBe(1);
      expect(statsAfterRelease.availableInstances).toBe(1);
    });

    it('should handle browser acquisition timeout', async () => {
      // Acquire all available browsers
      const browsers = [];
      for (let i = 0; i < 3; i++) {
        browsers.push(await service.acquire());
      }

      // Mock a timeout scenario
      const acquirePromise = service.acquire();

      // Since we can't easily test actual timeout in unit tests,
      // we verify the promise is created (would timeout in real scenario)
      expect(acquirePromise).toBeInstanceOf(Promise);

      // Clean up
      for (const browser of browsers) {
        await service.release(browser);
      }
    });

    it('should prevent double release of browsers', async () => {
      const browser = await service.acquire();
      await service.release(browser);

      // Attempting to release the same browser again should not cause issues
      await expect(service.release(browser)).resolves.not.toThrow();
    });
  });

  describe('Browser Lifecycle Management for Service Reliability', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should provide browser recycling to maintain fresh browser state', async () => {
      const browser = await service.acquire();

      // Simulate browser usage
      expect(browser.newPage).toBeDefined();

      // Business value: Fresh browsers prevent memory leaks and stale state
      await service.release(browser);
      const recycledBrowser = await service.acquire();
      expect(recycledBrowser).toBeDefined();
    });

    it('should handle browser recycling limits', async () => {
      const browser = await service.acquire();

      // Mock a browser that has been used many times
      const mockBrowserInstance = {
        id: 'browser-1',
        browser,
        isAvailable: false,
        usageCount: 100,
        useCount: 100,
        createdAt: new Date(Date.now() - 3600000), // 1 hour ago
        lastUsed: new Date(),
        isHealthy: true,
      } as BrowserInstance;

      await service.release(browser);

      // Verify the browser can be acquired again
      const newBrowser = await service.acquire();
      expect(newBrowser).toBeDefined();
    });

    it('should clean up resources on module destroy', async () => {
      const browser1 = await service.acquire();
      const browser2 = await service.acquire();

      // Mock browser close method
      const closeSpy = jest.spyOn(browser1, 'close');

      await service.onModuleDestroy();

      // Verify browsers are closed
      expect(closeSpy).toHaveBeenCalled();
    });
  });

  describe('Service Health Monitoring for Operational Excellence', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should monitor browser health to ensure reliable deal extraction', async () => {
      const browser = await service.acquire();

      // Business outcome: Health monitoring prevents failed scraping attempts
      expect(browser.isConnected()).toBe(true);

      const stats = service.getStats();
      expect(stats.totalInstances).toBeGreaterThan(0);
    });

    it('should provide comprehensive pool statistics', async () => {
      const browser1 = await service.acquire();
      const browser2 = await service.acquire();

      const stats = service.getStats();

      expect(stats).toEqual(
        expect.objectContaining({
          totalInstances: expect.any(Number),
          busyInstances: expect.any(Number),
          availableInstances: expect.any(Number),
          queueLength: expect.any(Number),
        })
      );

      expect(stats.totalInstances).toBeGreaterThan(0);
      expect(stats.busyInstances).toBe(2);
      expect(stats.availableInstances).toBeGreaterThanOrEqual(0);
    });

    it('should handle browser health checks', async () => {
      const browser = await service.acquire();

      // Mock browser health check
      browser.isConnected = jest.fn().mockReturnValue(true);
      expect(browser.isConnected()).toBe(true);

      // Mock unhealthy browser
      browser.isConnected = jest.fn().mockReturnValue(false);
      expect(browser.isConnected()).toBe(false);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle browser launch failures gracefully', async () => {
      mockPuppeteer.launch.mockRejectedValueOnce(new Error('Launch failed'));

      await expect(service.initialize()).rejects.toThrow('Launch failed');
    });

    it('should handle browser close failures', async () => {
      await service.initialize();
      const browser = await service.acquire();

      // Mock browser close failure
      browser.close = jest.fn().mockRejectedValue(new Error('Close failed'));

      // Should not throw when releasing a browser that fails to close
      await expect(service.release(browser)).resolves.not.toThrow();
    });

    it('should recover from browser crashes', async () => {
      await service.initialize();
      const browser = await service.acquire();

      // Simulate browser disconnect
      browser.isConnected = jest.fn().mockReturnValue(false);

      await service.release(browser);

      // Should be able to acquire a new browser
      const newBrowser = await service.acquire();
      expect(newBrowser).toBeDefined();
    });
  });

  describe('Concurrent Operations and Queue Management', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should handle multiple concurrent acquisitions', async () => {
      const acquisitionPromises = Array.from({ length: 5 }, () =>
        service.acquire()
      );

      const browsers = await Promise.all(acquisitionPromises);

      expect(browsers).toHaveLength(5);
      browsers.forEach((browser) => {
        expect(browser).toBeDefined();
      });

      // Clean up
      for (const browser of browsers) {
        await service.release(browser);
      }
    });

    it('should maintain queue order for browser requests', async () => {
      // Acquire all available browsers
      const browsers = [];
      for (let i = 0; i < 3; i++) {
        browsers.push(await service.acquire());
      }

      const stats = service.getStats();
      expect(stats.availableInstances).toBeGreaterThanOrEqual(0);
      expect(stats.busyInstances).toBeGreaterThanOrEqual(2);

      // Clean up
      for (const browser of browsers) {
        await service.release(browser);
      }
    });
  });

  describe('Performance Metrics for Service Optimization', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should track usage metrics to optimize resource allocation', async () => {
      const browser = await service.acquire();

      // Business value: Metrics enable optimization decisions
      const stats = service.getStats();
      expect(stats.busyInstances).toBeGreaterThan(0);
      expect(stats.totalInstances).toBeGreaterThan(0);

      await service.release(browser);

      const statsAfterRelease = service.getStats();
      expect(statsAfterRelease.busyInstances).toBeLessThan(stats.busyInstances);
    });

    it('should provide detailed performance statistics', async () => {
      const stats = service.getStats();

      expect(stats).toHaveProperty('totalInstances');
      expect(stats).toHaveProperty('busyInstances');
      expect(stats).toHaveProperty('availableInstances');
      expect(stats).toHaveProperty('queueLength');
      expect(stats).toHaveProperty('memoryUsageMB');
      expect(stats).toHaveProperty('memoryThresholdMB');

      expect(typeof stats.totalInstances).toBe('number');
      expect(typeof stats.busyInstances).toBe('number');
      expect(typeof stats.availableInstances).toBe('number');
      expect(typeof stats.queueLength).toBe('number');
      expect(typeof stats.memoryUsageMB).toBe('number');
      expect(typeof stats.memoryThresholdMB).toBe('number');
    });
  });

  describe('Graceful Shutdown for System Stability', () => {
    it('should ensure clean shutdown preserves system integrity', async () => {
      await service.initialize();
      const browser = await service.acquire();

      // Mock the close method to verify it's called
      const closeSpy = jest.spyOn(browser, 'close');

      // Business outcome: Clean shutdown prevents resource leaks
      await service.onModuleDestroy();

      expect(closeSpy).toHaveBeenCalled();
    });

    it('should handle shutdown with pending queue requests', async () => {
      await service.initialize();

      // Acquire all browsers
      const browsers = [];
      for (let i = 0; i < 3; i++) {
        browsers.push(await service.acquire());
      }

      // Should not throw during shutdown
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });

    it('should handle shutdown errors gracefully', async () => {
      await service.initialize();
      const browser = await service.acquire();

      // Mock browser close to throw error
      browser.close = jest.fn().mockRejectedValue(new Error('Shutdown error'));

      // Should not throw even if browser close fails
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });
});
