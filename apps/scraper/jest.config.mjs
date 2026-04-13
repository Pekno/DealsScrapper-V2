import base from '../../jest.base.config.mjs';

export default {
  ...base,
  displayName: 'scraper',
  rootDir: '.',
  testMatch: [
    '<rootDir>/test/unit/**/*.spec.ts',
  ],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  coverageDirectory: 'coverage/scraper',
  testTimeout: 30000,
};