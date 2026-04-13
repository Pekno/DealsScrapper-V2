// Global test setup for scraper service
import { config } from 'dotenv';

// Load environment variables for testing
config({ path: '../../.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL_HOST ||
  'postgresql://test:test@localhost:5433/dealscrapper_test';

// Redis Configuration for real Redis usage (aligned with other services)
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6380';
process.env.REDIS_DB = process.env.REDIS_DB || '0';

// Scraper-specific environment variables
process.env.PUPPETEER_MAX_INSTANCES = '2';
process.env.PUPPETEER_TIMEOUT = '30000';
process.env.PUPPETEER_HEADLESS = 'new';
process.env.ELASTICSEARCH_NODE =
  process.env.ELASTICSEARCH_NODE || 'http://localhost:9201';

// Configure timeouts for scraper operations
jest.setTimeout(30000);

// Suppress console logs during tests unless there's an error
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.log = (...args) => {
    if (process.env.TEST_VERBOSE === 'true') {
      originalConsoleLog(...args);
    }
  };

  console.warn = (...args) => {
    if (process.env.TEST_VERBOSE === 'true') {
      originalConsoleWarn(...args);
    }
  };
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
});

// Ensure all necessary polyfills are available for NestJS decorators
// NestJS should provide its own reflect-metadata import

// Global test cleanup
beforeEach(() => {
  jest.clearAllTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.clearAllMocks();
});

afterAll(async () => {
  // Cleanup any remaining timers
  jest.clearAllTimers();
  jest.useRealTimers();

  // Allow time for Redis connections to close properly
  await new Promise((resolve) => setTimeout(resolve, 1000));
});

// NOTE: Bull queues now use REAL Redis for true integration testing
// This aligns with API, Notifier, and Scheduler services

// Enhanced Mock for Puppeteer to prevent browser instances and handle all test scenarios
const createMockPage = () => ({
  goto: jest.fn().mockResolvedValue(undefined),
  content: jest
    .fn()
    .mockResolvedValue('<html><body>Mock content</body></html>'),
  close: jest.fn().mockResolvedValue(undefined),
  evaluate: jest.fn().mockResolvedValue(true),
  url: jest.fn().mockReturnValue('https://example.com'),
  title: jest.fn().mockResolvedValue('Mock Page Title'),
  setViewport: jest.fn().mockResolvedValue(undefined),
  setUserAgent: jest.fn().mockResolvedValue(undefined),
  waitForSelector: jest.fn().mockResolvedValue({}),
  waitForTimeout: jest.fn().mockResolvedValue(undefined),
  screenshot: jest.fn().mockResolvedValue(Buffer.from('mock-screenshot')),
  pdf: jest.fn().mockResolvedValue(Buffer.from('mock-pdf')),
  click: jest.fn().mockResolvedValue(undefined),
  type: jest.fn().mockResolvedValue(undefined),
  select: jest.fn().mockResolvedValue([]),
  focus: jest.fn().mockResolvedValue(undefined),
  hover: jest.fn().mockResolvedValue(undefined),
  reload: jest.fn().mockResolvedValue(undefined),
  goBack: jest.fn().mockResolvedValue(undefined),
  goForward: jest.fn().mockResolvedValue(undefined),
  setExtraHTTPHeaders: jest.fn().mockResolvedValue(undefined),
  setCookie: jest.fn().mockResolvedValue(undefined),
  deleteCookie: jest.fn().mockResolvedValue(undefined),
  addScriptTag: jest.fn().mockResolvedValue({}),
  addStyleTag: jest.fn().mockResolvedValue({}),
  exposeFunction: jest.fn().mockResolvedValue(undefined),
  setRequestInterception: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  off: jest.fn(),
  once: jest.fn(),
  emit: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn(),
  isClosed: jest.fn().mockReturnValue(false),
  browser: jest.fn().mockReturnValue(null),
  browserContext: jest.fn().mockReturnValue(null),
  mainFrame: jest.fn().mockReturnValue({}),
  frames: jest.fn().mockReturnValue([]),
  workers: jest.fn().mockReturnValue([]),
});

const createMockBrowser = () => ({
  newPage: jest.fn().mockResolvedValue(createMockPage()),
  close: jest.fn().mockResolvedValue(undefined),
  isConnected: jest.fn().mockReturnValue(true),
  process: jest.fn().mockReturnValue({
    pid: Math.floor(Math.random() * 100000),
    kill: jest.fn(),
  }),
  version: jest.fn().mockResolvedValue('120.0.0.0'),
  pages: jest.fn().mockResolvedValue([createMockPage()]),
  on: jest.fn(),
  off: jest.fn(),
  once: jest.fn(),
  emit: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn(),
  targets: jest.fn().mockReturnValue([]),
  target: jest.fn().mockReturnValue({}),
  waitForTarget: jest.fn().mockResolvedValue({}),
  userAgent: jest.fn().mockResolvedValue('Mock User Agent'),
  wsEndpoint: jest.fn().mockReturnValue('ws://mock-endpoint'),
  disconnect: jest.fn(),
  createIncognitoBrowserContext: jest.fn().mockResolvedValue({}),
  defaultBrowserContext: jest.fn().mockReturnValue({}),
  browserContexts: jest.fn().mockReturnValue([]),
});

jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue(createMockBrowser()),
  connect: jest.fn().mockResolvedValue(createMockBrowser()),
  createBrowserFetcher: jest.fn().mockReturnValue({
    download: jest.fn().mockResolvedValue({}),
    localRevisions: jest.fn().mockReturnValue([]),
    platform: jest.fn().mockReturnValue('linux'),
    product: jest.fn().mockReturnValue('chrome'),
  }),
  defaultArgs: jest.fn().mockReturnValue([]),
  executablePath: jest.fn().mockReturnValue('/mock/path/to/chrome'),
}));

export {};
