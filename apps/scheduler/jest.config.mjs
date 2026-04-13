import base from '../../jest.base.config.mjs';

export default {
  ...base,
  displayName: 'scheduler',
  rootDir: '.',
  testMatch: [
    '<rootDir>/test/unit/**/*.spec.ts',
  ],
  coverageDirectory: 'coverage/scheduler',
};