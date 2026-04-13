import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { SharedConfigService } from '@dealscrapper/shared-config';
import { SiteSource } from '@dealscrapper/shared-types';
import puppeteer from 'puppeteer-extra';
import type * as PuppeteerCore from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { EventEmitter } from 'events';
import { extractErrorMessage } from '@dealscrapper/shared';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CookieFilterService } from './cookie-filter.service.js';

// Configure stealth plugin with all evasions enabled
const stealth = StealthPlugin();
puppeteer.use(stealth);

/**
 * Browser instance metadata for pool management
 */
export interface BrowserInstance {
  readonly id: string;
  readonly browser: PuppeteerCore.Browser;
  isAvailable: boolean;
  lastUsed: Date;
  useCount: number;
}

/**
 * Pool performance and health statistics
 */
export interface PoolStats {
  readonly totalInstances: number;
  readonly availableInstances: number;
  readonly busyInstances: number;
  readonly queueLength: number;
  readonly totalRequests: number;
  readonly avgWaitTime: number;
  readonly queuedRequests: number;
  readonly successfulRequests: number;
  readonly failedRequests: number;
  readonly healthStatus: PoolHealthStatus;
  readonly memoryUsageMB: number;
  readonly memoryThresholdMB: number;
}

/**
 * Pool health status levels
 */
export type PoolHealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Queue item for waiting browser requests
 */
interface QueuedRequest {
  readonly resolve: (browser: PuppeteerCore.Browser) => void;
  readonly reject: (error: Error) => void;
  readonly timestamp: number;
  readonly timeoutId?: NodeJS.Timeout;
}

/**
 * Pool configuration constants
 */
interface PoolConfig {
  readonly maxInstances: number;
  readonly maxUseCount: number;
  readonly maxAgeMs: number;
  readonly queueTimeoutMs: number;
  readonly healthCheckIntervalMs: number;
  readonly minInstances: number;
  readonly memoryThresholdMB: number;
}

@Injectable()
export class PuppeteerPoolService implements OnModuleDestroy {
  private readonly logger = new Logger(PuppeteerPoolService.name);
  private readonly pool: Map<string, BrowserInstance> = new Map();
  private readonly waitQueue: QueuedRequest[] = [];
  private readonly eventEmitter = new EventEmitter();
  private readonly config: PoolConfig;

  // Performance tracking
  private totalRequests = 0;
  private totalWaitTime = 0;
  private successfulRequests = 0;
  private failedRequests = 0;
  private isShuttingDown = false;
  private healthCheckInterval?: NodeJS.Timeout;

  // Disconnection tracking for pattern analysis
  private readonly disconnectionHistory: Array<{
    instanceId: string;
    timestamp: Date;
    reason: string;
    instanceAge: number;
    useCount: number;
  }> = [];
  private readonly maxDisconnectionHistory = 50;

  // Resource blocking statistics
  private readonly resourceBlockingStats = {
    totalBlocked: 0,
    imageBlocked: 0,
    fontBlocked: 0,
    analyticsBlocked: 0,
  };

  // Test mode flag for using local fixtures instead of real websites
  private readonly isTestMode: boolean;

  constructor(
    private readonly sharedConfig: SharedConfigService,
    private readonly cookieFilter: CookieFilterService,
  ) {
    this.config = this.createPoolConfig();
    this.isTestMode = this.sharedConfig.get<string>('NODE_ENV') === 'test';

    if (this.isTestMode) {
      this.logger.log('🧪 TEST MODE: Will use local HTML fixtures instead of real websites');
    } else {
      this.logger.log(
        `Initializing Puppeteer pool with max ${this.config.maxInstances} instances, ` +
          `memory threshold ${this.config.memoryThresholdMB}MB`
      );
    }

    this.startHealthCheckScheduler();
  }

  /**
   * Initializes the pool with minimum browser instances for immediate availability
   * @throws Error if initialization fails
   */
  async initialize(): Promise<void> {
    const promises = Array.from({ length: this.config.minInstances }, () =>
      this.createBrowserInstance()
    );

    await Promise.all(promises);
    this.logger.log(
      `Pool initialized with ${this.config.minInstances} browser instances`
    );
  }

  /**
   * Acquires a browser instance from the pool, creating one if available or queuing the request
   * @returns Promise that resolves to an available browser instance
   * @throws Error if acquisition fails or times out
   */
  async acquire(): Promise<PuppeteerCore.Browser> {
    this.totalRequests++;
    const startTime = Date.now();

    try {
      // Try to get an immediately available instance
      const availableInstance = this.getAvailableInstance();
      if (availableInstance) {
        this.recordSuccessfulRequest(startTime);
        return availableInstance;
      }

      // Try to create a new instance if pool has capacity and memory allows
      if (this.pool.size < this.config.maxInstances) {
        const currentMemoryMB = this.getMemoryUsageMB();
        if (currentMemoryMB >= this.config.memoryThresholdMB) {
          this.logger.warn(
            `Memory pressure detected (${currentMemoryMB}MB / ${this.config.memoryThresholdMB}MB threshold) — ` +
              `queuing request instead of spawning new browser`
          );
        } else {
          const browser = await this.createAndReserveBrowserInstance();
          this.recordSuccessfulRequest(startTime);
          return browser;
        }
      }

      // Queue the request and wait for availability
      const browser = await this.enqueueRequest(startTime);
      this.recordSuccessfulRequest(startTime);
      return browser;
    } catch (error) {
      this.failedRequests++;
      this.logger.error('Failed to acquire browser instance:', error);
      throw error;
    }
  }

  /**
   * Releases a browser instance back to the pool for reuse or restart evaluation
   * @param browser - The browser instance to release
   */
  async release(browser: PuppeteerCore.Browser): Promise<void> {
    const instance = this.findInstanceByBrowser(browser);
    if (!instance) {
      this.logger.warn('Attempted to release unknown browser instance');
      return;
    }

    instance.useCount++;

    // Evaluate if instance should be restarted before making it available
    if (await this.shouldRestartInstance(instance)) {
      await this.restartInstance(instance.id);
    } else {
      instance.isAvailable = true;
      instance.lastUsed = new Date();
    }

    // Process any waiting requests
    this.processWaitQueue();

    this.logger.debug(`Released browser instance ${instance.id}`);
  }

  /**
   * Convenience method to fetch page HTML content using a pooled browser
   * Handles acquire, navigation, content extraction, and release automatically
   * In test mode, returns content from local HTML fixtures instead
   * @param url - URL to fetch
   * @param options - Optional configuration
   * @returns HTML content of the page
   */
  async fetchPage(
    url: string,
    options: { timeout?: number; waitFor?: string } = {},
  ): Promise<string> {
    // In test mode, return fixture content instead of fetching real pages
    if (this.isTestMode) {
      return this.getFixtureContent(url);
    }

    const { timeout = 30000, waitFor } = options;
    const browser = await this.acquire();

    try {
      const page = await this.createPage(browser);

      try {
        // Set a reasonable timeout
        page.setDefaultNavigationTimeout(timeout);

        // Anti-detection: Add small random delay before navigation (human-like)
        await this.humanDelay(300, 800);

        // Navigate to the URL with networkidle2 for better page loading
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: timeout,
        });

        // Remove cookie/consent popup elements from DOM
        await this.removeCookieElements(page);

        // Anti-detection: Add small delay after page load (human-like)
        await this.humanDelay(500, 1500);

        // Optionally wait for a specific selector
        if (waitFor) {
          await page.waitForSelector(waitFor, { timeout: timeout / 2 });
        }

        // Get the HTML content
        const html = await page.content();
        return html;
      } finally {
        await page.close();
      }
    } finally {
      await this.release(browser);
    }
  }

  /**
   * Get HTML content from local fixture file for test mode
   * Supports multiple sites: dealabs, vinted, leboncoin
   * @param url - URL to map to fixture file
   * @returns HTML content from fixture file
   */
  private async getFixtureContent(url: string): Promise<string> {
    this.logger.debug(`🧪 TEST MODE: Loading fixture for URL: ${url}`);

    // Determine site and category from URL
    const { siteId, categorySlug } = this.parseUrlForFixture(url);
    const fixtureName = `${siteId}-${categorySlug}.html`;

    // Check multiple possible fixture locations
    const possiblePaths = [
      path.join(process.cwd(), 'apps', 'scraper', 'test', 'fixtures', fixtureName),
      path.join(process.cwd(), 'test', 'fixtures', fixtureName),
    ];

    for (const fixturePath of possiblePaths) {
      try {
        const html = await fs.readFile(fixturePath, 'utf-8');
        this.logger.debug(`✅ Loaded test fixture: ${fixtureName} from ${fixturePath}`);
        return html;
      } catch {
        // Try next path
      }
    }

    const errorMsg = `Test fixture not found: ${fixtureName}. Searched in: ${possiblePaths.join(', ')}`;
    this.logger.error(`❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }

  /**
   * Parse URL to determine site ID and category slug for fixture mapping
   * @param url - URL to parse
   * @returns Object with siteId and categorySlug
   */
  private parseUrlForFixture(url: string): { siteId: string; categorySlug: string } {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      // Determine site from hostname
      let siteId: string;
      if (hostname.includes(SiteSource.DEALABS)) {
        siteId = SiteSource.DEALABS;
      } else if (hostname.includes(SiteSource.VINTED)) {
        siteId = SiteSource.VINTED;
      } else if (hostname.includes(SiteSource.LEBONCOIN)) {
        siteId = SiteSource.LEBONCOIN;
      } else {
        siteId = 'unknown';
      }

      // Extract category slug from URL path
      // Examples:
      // - https://www.dealabs.com/groupe/accessoires-gaming → accessoires-gaming
      // - https://www.vinted.fr/catalog?catalog[]=5 → catalog-5
      // - https://www.leboncoin.fr/c/multimedia → multimedia
      const pathname = urlObj.pathname;
      let categorySlug = 'default';

      if (siteId === SiteSource.DEALABS) {
        // /groupe/category-slug or /groupe/category-slug?params
        const match = pathname.match(/\/groupe\/([^/?]+)/);
        if (match) {
          categorySlug = match[1];
        }
      } else if (siteId === SiteSource.VINTED) {
        // /catalog?catalog[]=123 → use catalog ID
        const catalogId = urlObj.searchParams.get('catalog[]');
        if (catalogId) {
          categorySlug = `catalog-${catalogId}`;
        } else {
          const match = pathname.match(/\/([^/?]+)$/);
          if (match) {
            categorySlug = match[1];
          }
        }
      } else if (siteId === SiteSource.LEBONCOIN) {
        // /c/category-name or /recherche?category=X
        const match = pathname.match(/\/c\/([^/?]+)/);
        if (match) {
          categorySlug = match[1];
        } else {
          const category = urlObj.searchParams.get('category');
          if (category) {
            categorySlug = `category-${category}`;
          }
        }
      }

      this.logger.debug(`🔍 Parsed URL for fixture: siteId=${siteId}, categorySlug=${categorySlug}`);
      return { siteId, categorySlug };
    } catch (error) {
      this.logger.warn(`Failed to parse URL for fixture: ${url}, using defaults`);
      return { siteId: SiteSource.DEALABS, categorySlug: 'default' };
    }
  }

  /**
   * Retrieves current pool statistics for monitoring and health checks
   * @returns Comprehensive pool statistics
   */
  getStats(): PoolStats {
    const { availableInstances, busyInstances } =
      this.calculateInstanceCounts();
    const healthStatus = this.determineHealthStatus(
      availableInstances,
      busyInstances
    );

    return {
      totalInstances: this.pool.size,
      availableInstances,
      busyInstances,
      queueLength: this.waitQueue.length,
      totalRequests: this.totalRequests,
      avgWaitTime: this.calculateAverageWaitTime(),
      queuedRequests: this.waitQueue.length,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      healthStatus,
      memoryUsageMB: this.getMemoryUsageMB(),
      memoryThresholdMB: this.config.memoryThresholdMB,
    };
  }

  /**
   * Get resource blocking statistics
   * @returns Statistics about blocked resources (images, fonts, analytics)
   */
  getResourceBlockingStats(): typeof this.resourceBlockingStats {
    return { ...this.resourceBlockingStats };
  }

  /**
   * Gracefully shuts down the pool and cleans up all resources
   */
  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;
    this.logger.log('Shutting down Puppeteer pool...');

    this.stopHealthCheckScheduler();
    this.rejectAllQueuedRequests();
    await this.closeAllBrowserInstances();

    this.logger.log('Puppeteer pool shutdown complete');
  }

  // Private helper methods

  /**
   * Creates pool configuration from environment variables
   * @returns Pool configuration object
   */
  private createPoolConfig(): PoolConfig {
    const maxInstances = this.sharedConfig.get<number>(
      'PUPPETEER_MAX_INSTANCES'
    );
    const workerMaxMemoryMB = this.sharedConfig.get<number>('WORKER_MAX_MEMORY_MB');
    return {
      maxInstances,
      maxUseCount: 50,
      maxAgeMs: 30 * 60 * 1000, // 30 minutes
      queueTimeoutMs: 60 * 1000, // 60 seconds
      healthCheckIntervalMs: 60 * 1000, // 1 minute
      minInstances: Math.min(2, maxInstances),
      memoryThresholdMB: Math.floor(workerMaxMemoryMB * 0.8),
    };
  }

  /**
   * Returns current process RSS memory usage in megabytes
   */
  private getMemoryUsageMB(): number {
    return Math.round(process.memoryUsage().rss / 1024 / 1024);
  }

  /**
   * Starts the health check scheduler
   */
  private startHealthCheckScheduler(): void {
    this.healthCheckInterval = setInterval(
      () => void this.performHealthCheck(),
      this.config.healthCheckIntervalMs
    );
  }

  /**
   * Stops the health check scheduler
   */
  private stopHealthCheckScheduler(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  /**
   * Gets an available browser instance and marks it as busy
   * @returns Available browser instance or null if none available
   */
  private getAvailableInstance(): PuppeteerCore.Browser | null {
    for (const [id, instance] of this.pool) {
      if (instance.isAvailable && !this.isShuttingDown) {
        instance.isAvailable = false;
        this.logger.debug(`Acquired browser instance ${id}`);
        return instance.browser;
      }
    }
    return null;
  }

  /**
   * Records a successful request for metrics tracking
   * @param startTime - When the request started
   */
  private recordSuccessfulRequest(startTime: number): void {
    this.totalWaitTime += Date.now() - startTime;
    this.successfulRequests++;
  }

  /**
   * Creates a new browser instance and immediately reserves it
   * @returns New browser instance that is already marked as busy
   */
  private async createAndReserveBrowserInstance(): Promise<PuppeteerCore.Browser> {
    const browser = await this.createBrowserInstance();
    const instance = this.findInstanceByBrowser(browser);
    if (instance) {
      instance.isAvailable = false;
    }
    return browser;
  }

  /**
   * Enqueues a request to wait for an available browser instance
   * @param startTime - When the original request started
   * @returns Promise that resolves with an available browser
   */
  private async enqueueRequest(startTime: number): Promise<PuppeteerCore.Browser> {
    return new Promise((resolve, reject) => {
      // Set timeout for queued request with cleanup
      const timeoutId = setTimeout(() => {
        const index = this.waitQueue.indexOf(queueItem);
        if (index > -1) {
          this.waitQueue.splice(index, 1);
          this.totalWaitTime += Date.now() - startTime;
          reject(new Error('Timeout waiting for available browser instance'));
        }
      }, this.config.queueTimeoutMs);

      const queueItem: QueuedRequest = {
        resolve: (browser: PuppeteerCore.Browser) => {
          clearTimeout(timeoutId);
          resolve(browser);
        },
        reject: (error: Error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
        timestamp: Date.now(),
        timeoutId,
      };

      this.waitQueue.push(queueItem);
      this.logger.debug(
        `Added request to wait queue. Queue length: ${this.waitQueue.length}`
      );
    });
  }

  /**
   * Creates a new browser instance with optimized configuration
   * @returns New puppeteer browser instance
   */
  private async createBrowserInstance(): Promise<PuppeteerCore.Browser> {
    const instanceId = this.generateInstanceId();
    const launchConfig = {
      headless: true,
      executablePath: this.sharedConfig.get<string>('PUPPETEER_EXECUTABLE_PATH'),
      args: this.getBrowserLaunchArgs(),
      defaultViewport: {
        width: 1920,
        height: 1080,
      },
    };

    this.logger.debug(`🚀 Launching browser instance ${instanceId}...`);

    try {
      const browser = await puppeteer.launch(launchConfig);

      const instance: BrowserInstance = {
        id: instanceId,
        browser,
        isAvailable: true,
        lastUsed: new Date(),
        useCount: 0,
      };

      this.pool.set(instanceId, instance);
      this.setupBrowserEventHandlers(browser, instanceId);
      this.logger.log(`✅ Created browser instance ${instanceId}`);

      return browser;
    } catch (error) {
      this.logger.error(
        `❌ Failed to create browser instance ${instanceId}:\n` +
          `   🔧 Launch config: ${JSON.stringify(launchConfig, null, 2)}\n` +
          `   💥 Error: ${extractErrorMessage(error)}\n` +
          `   💡 Check system resources, Chrome installation, or Docker configuration`
      );
      throw error;
    }
  }

  /**
   * Generates a unique instance identifier
   * @returns Unique instance ID string
   */
  private generateInstanceId(): string {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).slice(2, 11);
    return `browser-${timestamp}-${randomSuffix}`;
  }

  /**
   * Gets optimized browser launch arguments with anti-detection measures
   * @returns Array of launch arguments for puppeteer
   */
  private getBrowserLaunchArgs(): string[] {
    return [
      // Required for Docker/containerized environments
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',

      // Anti-detection: Disable automation indicators
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',

      // Anti-detection: Make browser appear more like regular Chrome
      '--disable-infobars',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-component-update',
      '--disable-default-apps',
      '--disable-hang-monitor',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-sync',
      '--disable-translate',
      '--metrics-recording-only',
      '--safebrowsing-disable-auto-update',

      // WebRTC leak prevention (can reveal real IP)
      '--disable-webrtc-hw-encoding',
      '--disable-webrtc-hw-decoding',

      // Window configuration
      '--window-size=1920,1080',
      '--start-maximized',

      // Language and locale (appear as French user for French sites)
      '--lang=fr-FR',
      '--accept-lang=fr-FR,fr,en-US,en',
    ];
  }

  /**
   * Creates a new page on the given browser with anti-detection measures applied
   * (user agent, viewport, headers). Use this instead of browser.newPage() directly.
   */
  async createPage(browser: PuppeteerCore.Browser): Promise<PuppeteerCore.Page> {
    const page = await browser.newPage();
    await this.setupPage(page);
    return page;
  }

  /**
   * Configures a page with anti-detection measures: user agent, viewport, headers.
   */
  private async setupPage(page: PuppeteerCore.Page): Promise<void> {
    const { userAgent } = this.getRandomUserAgent();

    await page.setUserAgent(userAgent);

    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      hasTouch: false,
      isLandscape: true,
      isMobile: false,
    });

    // Only set headers that are safe for ALL request types.
    // Do NOT set Sec-Fetch-* or Sec-Ch-Ua-* here — setExtraHTTPHeaders applies
    // to every request (navigation, fetch, XHR, etc.), which overrides the
    // correct per-request values Chromium sets automatically. For example,
    // a fetch() to api.leboncoin.fr needs Sec-Fetch-Mode: cors, not navigate.
    // The stealth plugin already handles Client Hints (Sec-Ch-Ua-*).
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    });
  }

  /**
   * Returns a realistic user agent string and matching Chrome version.
   * Rotates between recent Chrome versions on Windows/Mac.
   */
  private getRandomUserAgent(): { userAgent: string; chromeVersion: string } {
    const versions = [
      { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36', v: '134' },
      { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36', v: '133' },
      { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36', v: '134' },
      { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36', v: '133' },
      { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36', v: '132' },
    ];
    const pick = versions[Math.floor(Math.random() * versions.length)];
    return { userAgent: pick.ua, chromeVersion: pick.v };
  }

  /**
   * Adds a random delay to simulate human behavior
   * @param minMs Minimum delay in milliseconds
   * @param maxMs Maximum delay in milliseconds
   */
  private async humanDelay(minMs: number = 500, maxMs: number = 2000): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Removes cookie/consent popup elements from the DOM.
   * Uses selectors from the Fanboy Cookie Monster filter list.
   *
   * Unlike CSS hiding (display: none), DOM removal avoids collateral damage
   * on legitimate UI elements that share selectors like [role="dialog"].
   */
  async removeCookieElements(page: PuppeteerCore.Page): Promise<void> {
    const selectors = this.cookieFilter.getSelectors();
    if (selectors.length === 0) return;

    try {
      const removed = await page.evaluate((sels: string[]) => {
        const doc = (globalThis as any).document;
        let count = 0;
        for (const sel of sels) {
          try {
            const elements = doc.querySelectorAll(sel);
            for (const el of elements) {
              el.remove();
              count++;
            }
          } catch {
            // Invalid selector, skip
          }
        }
        return count;
      }, selectors);

      if (removed > 0) {
        this.logger.debug(`Removed ${removed} cookie/consent elements from DOM`);
      }
    } catch {
      // Page may have been closed or navigated away
    }
  }

  /**
   * Starts a screencast recording of the browser page.
   * Records to logs/debug/{label}-{timestamp}.webm
   * Only records in non-production environments.
   *
   * @returns The ScreenRecorder instance (pass to stopScreencast), or null in production
   */
  async startScreencast(
    page: PuppeteerCore.Page,
    label: string,
  ): Promise<PuppeteerCore.ScreenRecorder | null> {
    if (this.sharedConfig.isProductionMode()) return null;

    const debugDir = path.resolve('logs', 'debug');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const recordingPath = path.join(debugDir, `${label}-${timestamp}.webm`);

    try {
      await fs.mkdir(debugDir, { recursive: true });
      const recorder = await page.screencast({ path: recordingPath as `${string}.webm` });
      this.logger.log(`Screencast recording started: ${recordingPath}`);
      return recorder;
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      this.logger.warn(`Failed to start screencast: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Stops a screencast recording.
   */
  async stopScreencast(recorder: PuppeteerCore.ScreenRecorder | null): Promise<void> {
    if (!recorder) return;

    try {
      await recorder.stop();
      // Wait for the stream (and its piped file write stream) to fully close
      if (!recorder.closed) {
        await new Promise<void>((resolve) => {
          recorder.on('close', resolve);
        });
      }
      this.logger.log('Screencast recording saved');
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      this.logger.warn(`Failed to stop screencast: ${errorMessage}`);
    }
  }

  /**
   * Sets up event handlers for a browser instance
   * @param browser - The browser instance
   * @param instanceId - The instance identifier
   */
  private setupBrowserEventHandlers(
    browser: PuppeteerCore.Browser,
    instanceId: string
  ): void {
    // Track when instance was created for age calculation
    const createdAt = new Date();

    browser.on('disconnected', () => {
      const instance = this.pool.get(instanceId);
      const instanceAge = Date.now() - createdAt.getTime();
      const useCount = instance?.useCount || 0;
      const isAvailable = instance?.isAvailable ?? false;

      // Determine likely reason for disconnection
      const disconnectionReason = this.analyzeDisconnectionReason({
        instanceAge,
        useCount,
        isAvailable,
        maxUseCount: this.config.maxUseCount,
        maxAgeMs: this.config.maxAgeMs,
      });

      this.logger.warn(
        `🔌 Browser instance ${instanceId} disconnected unexpectedly\n` +
          `   📊 Instance stats: age=${Math.round(instanceAge / 1000)}s, uses=${useCount}, available=${isAvailable}\n` +
          `   🔍 Likely reason: ${disconnectionReason.reason}\n` +
          `   💡 ${disconnectionReason.suggestion}`
      );

      // Track disconnection for health monitoring
      this.trackDisconnection(instanceId, disconnectionReason);

      this.pool.delete(instanceId);
      this.processWaitQueue();
    });

    // Monitor target crashes (pages/tabs crashing)
    browser.on('targetcreated', (target: PuppeteerCore.Target) => {
      // Note: 'targetcrashed' event is handled by Puppeteer internally
      // We'll monitor via page error events instead
      if (target.type() === 'page') {
        target
          .page()
          .then((page: PuppeteerCore.Page | null) => {
            if (page) {
              page.on('error', (error: Error) => {
                this.logger.warn(
                  `💥 Page error in browser instance ${instanceId}:\n` +
                    `   🔗 URL: ${page.url()}\n` +
                    `   💥 Error: ${error.message}\n` +
                    `   🔍 Type: Page crash or navigation failure`
                );
              });

              page.on('pageerror', (error: Error) => {
                this.logger.warn(
                  `🚨 Page script error in browser instance ${instanceId}:\n` +
                    `   🔗 URL: ${page.url()}\n` +
                    `   💥 Error: ${error.message}\n` +
                    `   🔍 Type: JavaScript execution error\n` +
                    `   💡 ${this.analyzeNetworkError(error.message)}`
                );
              });

              // Monitor network failures specifically
              page.on('requestfailed', (request: PuppeteerCore.HTTPRequest) => {
                const failureText = request.failure()?.errorText || 'Unknown';
                const resourceType = request.resourceType();
                const url = request.url();

                // Skip logging intentionally blocked resources to reduce noise
                const isIntentionallyBlocked =
                  ['image', 'font'].includes(resourceType) ||
                  url.includes('htlbid.com') ||
                  url.includes('ocular.dealabs.com') ||
                  failureText === 'net::ERR_ABORTED';

                if (!isIntentionallyBlocked) {
                  this.logger.warn(
                    `🌐 Network request failed in browser instance ${instanceId}:\n` +
                      `   🔗 URL: ${url}\n` +
                      `   📄 Page: ${page.url()}\n` +
                      `   💥 Failure: ${failureText}\n` +
                      `   🔍 Method: ${request.method()} | Type: ${resourceType}\n` +
                      `   💡 This may indicate target website blocking or network issues`
                  );
                } else {
                  // Track blocking statistics silently
                  this.resourceBlockingStats.totalBlocked++;
                  if (resourceType === 'image')
                    this.resourceBlockingStats.imageBlocked++;
                  if (resourceType === 'font')
                    this.resourceBlockingStats.fontBlocked++;
                  if (
                    url.includes('htlbid.com') ||
                    url.includes('ocular.dealabs.com')
                  ) {
                    this.resourceBlockingStats.analyticsBlocked++;
                  }
                  // No logging - intentionally blocked resources are expected
                }
              });

              // Monitor response status codes
              page.on('response', (response: PuppeteerCore.HTTPResponse) => {
                if (response.status() >= 400) {
                  this.logger.warn(
                    `⚠️ HTTP error response in browser instance ${instanceId}:\n` +
                      `   🔗 URL: ${response.url()}\n` +
                      `   📄 Page: ${page.url()}\n` +
                      `   📊 Status: ${response.status()} ${response.statusText()}\n` +
                      `   💡 ${this.analyzeHttpStatus(response.status())}`
                  );
                }
              });
            }
          })
          .catch(() => {
            // Ignore page access errors during target creation
          });
      }
    });

    // Monitor when pages are created and destroyed for debugging
    browser.on('targetcreated', (target: PuppeteerCore.Target) => {
      if (target.type() === 'page') {
        this.logger.debug(
          `📄 New page created in browser ${instanceId}: ${target.url()}`
        );
      }
    });

    browser.on('targetdestroyed', (target: PuppeteerCore.Target) => {
      if (target.type() === 'page') {
        this.logger.debug(
          `🗑️ Page destroyed in browser ${instanceId}: ${target.url()}`
        );
      }
    });
  }

  /**
   * Processes waiting requests in the queue when browsers become available
   */
  private processWaitQueue(): void {
    while (this.waitQueue.length > 0) {
      const availableInstance = this.getAvailableInstance();
      if (!availableInstance) break;

      const queueItem = this.waitQueue.shift();
      if (queueItem) {
        const waitTime = Date.now() - queueItem.timestamp;
        this.totalWaitTime += waitTime;
        this.logger.debug(`Fulfilled queued request after ${waitTime}ms wait`);
        queueItem.resolve(availableInstance);
      }
    }
  }

  /**
   * Calculates instance counts for statistics
   * @returns Object with available and busy instance counts
   */
  private calculateInstanceCounts(): {
    availableInstances: number;
    busyInstances: number;
  } {
    let availableInstances = 0;
    let busyInstances = 0;

    for (const instance of this.pool.values()) {
      if (instance.isAvailable) {
        availableInstances++;
      } else {
        busyInstances++;
      }
    }

    return { availableInstances, busyInstances };
  }

  /**
   * Calculates average wait time for requests
   * @returns Average wait time in milliseconds
   */
  private calculateAverageWaitTime(): number {
    return this.totalRequests > 0 ? this.totalWaitTime / this.totalRequests : 0;
  }

  /**
   * Determines pool health status based on current conditions
   * @param availableInstances - Number of available instances
   * @param busyInstances - Number of busy instances
   * @returns Health status assessment
   */
  private determineHealthStatus(
    availableInstances: number,
    busyInstances: number
  ): PoolHealthStatus {
    if (this.waitQueue.length > 5 || availableInstances === 0) {
      return 'unhealthy';
    }
    if (this.waitQueue.length > 2 || busyInstances > availableInstances) {
      return 'degraded';
    }
    return 'healthy';
  }

  /**
   * Rejects all queued requests during shutdown and cleans up timers
   */
  private rejectAllQueuedRequests(): void {
    while (this.waitQueue.length > 0) {
      const queueItem = this.waitQueue.shift();
      if (queueItem) {
        if (queueItem.timeoutId) {
          clearTimeout(queueItem.timeoutId);
        }
        queueItem.reject(new Error('Pool shutting down'));
      }
    }
  }

  /**
   * Closes all browser instances during shutdown
   */
  private async closeAllBrowserInstances(): Promise<void> {
    const closePromises = Array.from(this.pool.values()).map((instance) =>
      instance.browser
        .close()
        .catch((error: unknown) =>
          this.logger.error(`Error closing browser ${instance.id}:`, error)
        )
    );

    await Promise.all(closePromises);
    this.pool.clear();
  }

  /**
   * Evaluates whether a browser instance should be restarted based on usage and health
   * @param instance - The browser instance to evaluate
   * @returns True if the instance should be restarted
   */
  private async shouldRestartInstance(
    instance: BrowserInstance
  ): Promise<boolean> {
    // Check usage count threshold
    if (instance.useCount >= this.config.maxUseCount) {
      this.logger.debug(
        `Instance ${instance.id} reached max use count (${instance.useCount})`
      );
      return true;
    }

    // Check age threshold
    const instanceAge = Date.now() - instance.lastUsed.getTime();
    if (instanceAge > this.config.maxAgeMs) {
      this.logger.debug(
        `Instance ${instance.id} exceeded max age (${instanceAge}ms)`
      );
      return true;
    }

    // Check browser responsiveness
    return await this.isBrowserUnresponsive(instance);
  }

  /**
   * Tests if a browser instance is responsive
   * @param instance - The browser instance to test
   * @returns True if browser is unresponsive
   */
  private async isBrowserUnresponsive(
    instance: BrowserInstance
  ): Promise<boolean> {
    const testStart = Date.now();

    try {
      // Test 1: Check if browser is connected
      if (!instance.browser.isConnected()) {
        this.logger.warn(
          `🔌 Instance ${instance.id} is not connected - marking as unresponsive`
        );
        return true;
      }

      // Test 2: Try to get pages list
      const pages = await Promise.race([
        instance.browser.pages(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Pages list timeout')), 3000)
        ),
      ]);

      // Test 3: Try to evaluate on a page
      let testPage = pages[0];
      let shouldClosePage = false;

      if (!testPage) {
        testPage = await instance.browser.newPage();
        shouldClosePage = true;
      }

      try {
        await Promise.race([
          testPage.evaluate(() => ({
            timestamp: Date.now(),
            userAgent:
              (globalThis as unknown as { navigator?: { userAgent?: string } })
                .navigator?.userAgent || 'unknown',
          })),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Page evaluation timeout')), 5000)
          ),
        ]);

        const testDuration = Date.now() - testStart;
        this.logger.debug(
          `✅ Instance ${instance.id} responsiveness test passed in ${testDuration}ms`
        );

        return false;
      } finally {
        // Clean up test page if we created it
        if (shouldClosePage && testPage) {
          try {
            await testPage.close();
          } catch (closeError) {
            this.logger.warn(
              `⚠️ Failed to close test page for instance ${instance.id}:`,
              closeError
            );
          }
        }
      }
    } catch (error) {
      const testDuration = Date.now() - testStart;
      const errorMessage = extractErrorMessage(error);

      this.logger.warn(
        `⚠️ Instance ${instance.id} failed responsiveness test after ${testDuration}ms:\n` +
          `   💥 Error: ${errorMessage}\n` +
          `   🔍 This indicates the browser may be frozen, crashed, or overwhelmed`
      );
      return true;
    }
  }

  /**
   * Restarts a browser instance by closing and creating a replacement
   * @param instanceId - The ID of the instance to restart
   */
  private async restartInstance(instanceId: string): Promise<void> {
    const instance = this.pool.get(instanceId);
    if (!instance) {
      this.logger.warn(`Cannot restart instance ${instanceId}: not found`);
      return;
    }

    this.logger.log(`Restarting browser instance ${instanceId}`);

    try {
      await instance.browser.close();
    } catch (error) {
      this.logger.error(`Error closing browser instance ${instanceId}:`, error);
    }

    this.pool.delete(instanceId);

    // Create replacement if conditions allow
    if (!this.isShuttingDown && this.pool.size < this.config.maxInstances) {
      try {
        await this.createBrowserInstance();
      } catch (error) {
        this.logger.error(
          'Failed to create replacement browser instance:',
          error
        );
      }
    }
  }

  /**
   * Performs health check on all instances and maintains minimum pool size.
   * Also monitors memory usage and proactively closes idle instances under pressure.
   */
  private async performHealthCheck(): Promise<void> {
    if (this.isShuttingDown) return;

    const currentMemoryMB = this.getMemoryUsageMB();
    const criticalThresholdMB = Math.floor(this.config.memoryThresholdMB * 1.125); // 90% of WORKER_MAX_MEMORY_MB

    this.logger.log(
      `Health check — memory: ${currentMemoryMB}MB / ${this.config.memoryThresholdMB}MB threshold, ` +
        `pool: ${this.pool.size} instances, queue: ${this.waitQueue.length}`
    );

    // Proactively close idle instances if memory exceeds critical threshold
    if (currentMemoryMB >= criticalThresholdMB) {
      this.logger.warn(
        `Critical memory pressure (${currentMemoryMB}MB >= ${criticalThresholdMB}MB) — closing idle instances`
      );
      await this.closeIdleInstances();
    }

    await this.restartUnhealthyInstances();
    await this.maintainMinimumInstances();
  }

  /**
   * Closes all idle (available) browser instances to reclaim memory
   */
  private async closeIdleInstances(): Promise<void> {
    const idleInstanceIds: string[] = [];

    for (const [id, instance] of this.pool) {
      if (instance.isAvailable) {
        idleInstanceIds.push(id);
      }
    }

    for (const id of idleInstanceIds) {
      const instance = this.pool.get(id);
      if (!instance) continue;

      this.logger.log(`Closing idle instance ${id} to reclaim memory`);
      try {
        await instance.browser.close();
      } catch (error) {
        this.logger.error(`Error closing idle instance ${id}:`, error);
      }
      this.pool.delete(id);
    }

    if (idleInstanceIds.length > 0) {
      this.logger.log(
        `Closed ${idleInstanceIds.length} idle instance(s) — memory now: ${this.getMemoryUsageMB()}MB`
      );
    }
  }

  /**
   * Identifies and restarts unhealthy instances
   */
  private async restartUnhealthyInstances(): Promise<void> {
    const unhealthyInstanceIds: string[] = [];

    for (const [id, instance] of this.pool) {
      if (
        instance.isAvailable &&
        (await this.shouldRestartInstance(instance))
      ) {
        unhealthyInstanceIds.push(id);
      }
    }

    for (const id of unhealthyInstanceIds) {
      await this.restartInstance(id);
    }
  }

  /**
   * Ensures minimum number of instances are maintained
   */
  private async maintainMinimumInstances(): Promise<void> {
    while (this.pool.size < this.config.minInstances && !this.isShuttingDown) {
      try {
        await this.createBrowserInstance();
      } catch (error) {
        this.logger.error(
          `Failed to maintain minimum instances:\n` +
            `   📊 Current pool size: ${this.pool.size}/${this.config.minInstances} (min)\n` +
            `   💥 Error: ${extractErrorMessage(error)}\n` +
            `   🔍 Stack: ${error instanceof Error ? error.stack : 'N/A'}`
        );
        break;
      }
    }
  }

  /**
   * Finds a browser instance by its browser reference
   * @param browser - The browser to find
   * @returns The corresponding browser instance or null if not found
   */
  private findInstanceByBrowser(
    browser: PuppeteerCore.Browser
  ): BrowserInstance | null {
    for (const instance of this.pool.values()) {
      if (instance.browser === browser) {
        return instance;
      }
    }
    return null;
  }

  /**
   * Analyzes the likely reason for browser disconnection based on instance metrics
   * @param params - Instance metrics and thresholds
   * @returns Disconnection analysis with reason and suggestion
   */
  private analyzeDisconnectionReason(params: {
    instanceAge: number;
    useCount: number;
    isAvailable: boolean;
    maxUseCount: number;
    maxAgeMs: number;
  }): { reason: string; suggestion: string } {
    const { instanceAge, useCount, isAvailable, maxUseCount, maxAgeMs } =
      params;

    // Check for memory-related issues (high usage)
    if (useCount >= maxUseCount * 0.8) {
      return {
        reason: 'High usage count - likely memory accumulation',
        suggestion:
          'Consider reducing PUPPETEER_MAX_USE_COUNT or increasing restart frequency',
      };
    }

    // Check for age-related issues
    if (instanceAge >= maxAgeMs * 0.8) {
      return {
        reason: 'Instance age - scheduled for restart',
        suggestion: 'Normal behavior - instance was approaching maximum age',
      };
    }

    // Check if disconnection happened during active use
    if (!isAvailable) {
      return {
        reason: 'Disconnected during active scraping operation',
        suggestion:
          'Check target website blocking, network issues, or page complexity',
      };
    }

    // Check for potential resource exhaustion
    if (instanceAge < 60000 && useCount < 5) {
      return {
        reason: 'Early disconnection - possible resource/permission issue',
        suggestion:
          'Check browser launch args, system resources, or Docker configuration',
      };
    }

    // Check for medium-term stability issues
    if (instanceAge > 300000 && useCount > 20) {
      return {
        reason: 'Stability degradation after moderate usage',
        suggestion:
          'Browser may be accumulating state - normal restart behavior',
      };
    }

    // Default case
    return {
      reason: 'Unknown cause - unexpected disconnection',
      suggestion:
        'Monitor for patterns in disconnection timing and system resources',
    };
  }

  /**
   * Tracks disconnection for pattern analysis and health monitoring
   * @param instanceId - ID of the disconnected instance
   * @param disconnectionReason - Analysis of why it disconnected
   */
  private trackDisconnection(
    instanceId: string,
    disconnectionReason: { reason: string }
  ): void {
    const disconnectionRecord = {
      instanceId,
      timestamp: new Date(),
      reason: disconnectionReason.reason,
      instanceAge: 0, // Will be filled if available
      useCount: 0, // Will be filled if available
    };

    // Add to history and maintain size limit
    this.disconnectionHistory.push(disconnectionRecord);
    if (this.disconnectionHistory.length > this.maxDisconnectionHistory) {
      this.disconnectionHistory.splice(
        0,
        this.disconnectionHistory.length - this.maxDisconnectionHistory
      );
    }

    // Log patterns if we see frequent disconnections
    this.analyzeDisconnectionPatterns();
  }

  /**
   * Analyzes recent disconnection patterns to identify systemic issues
   */
  private analyzeDisconnectionPatterns(): void {
    const recentDisconnections = this.disconnectionHistory.filter(
      (record) => Date.now() - record.timestamp.getTime() < 300000 // Last 5 minutes
    );

    if (recentDisconnections.length >= 3) {
      const reasons = recentDisconnections.map((r) => r.reason);
      const uniqueReasons = [...new Set(reasons)];

      this.logger.warn(
        `⚠️ Pattern detected: ${recentDisconnections.length} disconnections in 5 minutes\n` +
          `   🔍 Reasons: ${uniqueReasons.join(', ')}\n` +
          `   💡 Consider checking system resources, network stability, or browser configuration`
      );
    }
  }

  /**
   * Analyzes network error messages to provide specific troubleshooting advice
   * @param errorMessage - The network error message
   * @returns Specific guidance for the error type
   */
  private analyzeNetworkError(errorMessage: string): string {
    const message = errorMessage.toLowerCase();

    if (message.includes('networkError') || message.includes('network error')) {
      return 'Network connectivity issue - check internet connection, DNS, or target website availability';
    }

    if (message.includes('timeout') || message.includes('timed out')) {
      return 'Request timeout - target website may be slow, overloaded, or blocking requests';
    }

    if (
      message.includes('connection refused') ||
      message.includes('econnrefused')
    ) {
      return 'Connection refused - target server may be down or blocking your IP address';
    }

    if (message.includes('dns') || message.includes('getaddrinfo')) {
      return 'DNS resolution failure - check DNS settings or target domain validity';
    }

    if (
      message.includes('ssl') ||
      message.includes('tls') ||
      message.includes('certificate')
    ) {
      return 'SSL/TLS error - certificate issues or security protocol mismatch';
    }

    if (message.includes('blocked') || message.includes('forbidden')) {
      return 'Request blocked - target website may have anti-bot protection active';
    }

    return 'Unknown network error - monitor for patterns and check system/network configuration';
  }

  /**
   * Analyzes HTTP status codes to provide specific troubleshooting advice
   * @param statusCode - The HTTP status code
   * @returns Specific guidance for the status code
   */
  private analyzeHttpStatus(statusCode: number): string {
    switch (Math.floor(statusCode / 100)) {
      case 4:
        switch (statusCode) {
          case 403:
            return 'Forbidden (403) - likely bot detection or IP blocking by target website';
          case 404:
            return 'Not Found (404) - URL may have changed or category may be inactive';
          case 429:
            return 'Rate Limited (429) - reduce scraping frequency or implement delays';
          case 401:
            return 'Unauthorized (401) - authentication may be required';
          case 400:
            return 'Bad Request (400) - check URL format and request parameters';
          default:
            return `Client Error (${statusCode}) - check request format and target website requirements`;
        }

      case 5:
        switch (statusCode) {
          case 502:
            return 'Bad Gateway (502) - target website server issues or CDN problems';
          case 503:
            return 'Service Unavailable (503) - target website temporarily down or overloaded';
          case 504:
            return 'Gateway Timeout (504) - target website response too slow';
          default:
            return `Server Error (${statusCode}) - target website experiencing technical issues`;
        }

      default:
        return `HTTP ${statusCode} - unusual status code, investigate target website behavior`;
    }
  }
}
