import base from '../../jest.base.config.mjs';

export default {
  ...base,
  displayName: 'notifier-e2e',
  rootDir: '.',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testMatch: ['<rootDir>/test/e2e/**/*.e2e-spec.ts'],
  coverageDirectory: 'coverage/notifier',
  testTimeout: 30000, // Longer timeout for integration tests with database
  maxWorkers: 1,
  // Prevent hanging on async operations
  forceExit: true,
  detectOpenHandles: false,
};
