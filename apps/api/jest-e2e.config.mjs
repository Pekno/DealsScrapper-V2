import base from '../../jest.base.config.mjs';

export default {
  ...base,
  displayName: 'api-e2e',
  rootDir: '.',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testMatch: ['<rootDir>/test/e2e/**/*.e2e-spec.ts'],
  coverageDirectory: 'coverage/api',
  testTimeout: 30000,
  maxWorkers: 1,
};
