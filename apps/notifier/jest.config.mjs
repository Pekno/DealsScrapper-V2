import base from '../../jest.base.config.mjs';

export default {
  ...base,
  displayName: 'notifier',
  rootDir: '.',
  testMatch: [
    '<rootDir>/test/unit/**/*.spec.ts',
  ],
  coverageDirectory: 'coverage/notifier',
  silent: true,
};