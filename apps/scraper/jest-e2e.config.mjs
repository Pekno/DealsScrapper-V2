import base from '../../jest.base.config.mjs';

export default {
  ...base,
  displayName: 'scraper-e2e',
  rootDir: '.',
  testMatch: ['<rootDir>/test/e2e/**/*.e2e-spec.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testTimeout: 30000,
  coverageDirectory: 'coverage/scheduler-e2e',
};