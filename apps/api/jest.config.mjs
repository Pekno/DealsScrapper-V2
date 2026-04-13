import base from '../../jest.base.config.mjs';

export default {
  ...base,
  rootDir: '.',
  testMatch: [
    '<rootDir>/test/unit/**/*.spec.ts',
  ],
  coverageDirectory: 'coverage/api',
};
