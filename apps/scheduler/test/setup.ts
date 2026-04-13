import 'reflect-metadata';
import { join } from 'path';
import { config } from 'dotenv';

// Load test environment variables
config({
  path: join(process.cwd(), '..', '..', '.env.test'),
});

// Set test environment
process.env.NODE_ENV = 'test';

// Database configuration for scheduler tests
process.env.DATABASE_URL =
  process.env.DATABASE_URL_HOST ||
  'postgresql://test:test@localhost:5433/dealscrapper_test';

// Set appropriate test timeout
jest.setTimeout(30000);

// Jest setup for scheduler service tests
// Provides common test environment configuration and utilities
