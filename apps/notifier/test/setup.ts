// Global test setup for notifier service
import { config } from 'dotenv';

// Load environment variables for testing
config({ path: '../../.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL_HOST ||
  'postgresql://test:test@localhost:5433/dealscrapper_test';

// Redis Configuration for tests
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6380';
process.env.REDIS_DB = process.env.REDIS_DB || '0';

// Email Configuration for tests (MailHog)
process.env.EMAIL_HOST = process.env.EMAIL_HOST || 'localhost';
process.env.EMAIL_PORT = process.env.EMAIL_PORT || '1025';

// Configure timeouts
jest.setTimeout(30000);
