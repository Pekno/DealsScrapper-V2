import base from '../../jest.base.config.mjs';

export default {
  ...base,
  rootDir: '.',
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.spec.ts',
  ],
  coverageDirectory: 'coverage/shared-types',
};
