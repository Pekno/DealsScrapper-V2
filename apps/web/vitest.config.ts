import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
      css: { modules: { classNameStrategy: 'non-scoped' } },
      coverage: {
        provider: 'v8',
        thresholds: { branches: 70, functions: 70, lines: 70, statements: 70 },
      },
    },
  })
);
