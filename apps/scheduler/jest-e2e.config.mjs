import base from '../../jest.base.config.mjs';

export default {
  ...base,
  displayName: 'scheduler-e2e',
  rootDir: '.',
  testRegex: 'test/e2e/.*\\.e2e-spec\\.ts$',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testTimeout: 30000,
  coverageDirectory: 'coverage/scheduler-e2e',
};