// Global test setup
import { ConfigModule } from '@nestjs/config';
import { config } from 'dotenv';

// Load environment variables for testing
config({ path: '../../.env' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL_HOST ||
  'postgresql://test:test@localhost:5433/dealscrapper_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';

// Configure timeouts
jest.setTimeout(30000);

// Global test utilities

// Custom JWT matcher
expect.extend({
  toBeValidJWT(received: string) {
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    const pass = jwtRegex.test(received);

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid JWT`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid JWT`,
        pass: false,
      };
    }
  },
});

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

export {};
