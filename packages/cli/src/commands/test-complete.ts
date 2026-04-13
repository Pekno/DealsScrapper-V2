import { defineCommand } from 'citty';
import { Listr } from 'listr2';
import { shellExec } from '../lib/docker.js';
import { Stopwatch, TimingReport } from '../lib/timing.js';
import { PROJECT_ROOT } from '../lib/constants.js';
import * as ui from '../lib/ui.js';
import pc from 'picocolors';

const UNIT_TESTS = [
  { name: 'API Unit Tests', script: 'test:api:unit' },
  { name: 'Scraper Unit Tests', script: 'test:scraper:unit' },
  { name: 'Notifier Unit Tests', script: 'test:notifier:unit' },
  { name: 'Scheduler Unit Tests', script: 'test:scheduler:unit' },
];

const E2E_TESTS = [
  { name: 'API E2E Tests', script: 'test:api:e2e' },
  { name: 'Notifier E2E Tests', script: 'test:notifier:e2e' },
  { name: 'Scheduler E2E Tests', script: 'test:scheduler:e2e' },
  { name: 'Scraper E2E Tests', script: 'test:scraper:e2e' },
];

export const testComplete = defineCommand({
  meta: {
    name: 'complete',
    description: 'Run the complete test suite with timing',
  },
  run: async () => {
    ui.banner('Complete Test Suite');

    const report = new TimingReport();
    const totalTimer = new Stopwatch();

    async function runPnpm(name: string, script: string): Promise<boolean> {
      const timer = new Stopwatch();
      const code = await shellExec('pnpm', ['run', script], { cwd: PROJECT_ROOT });
      const success = code === 0;
      report.add(name, timer.elapsed(), success);
      return success;
    }

    const tasks = new Listr([
      // Phase 1: Setup
      {
        title: 'Phase 1: Infrastructure & Build',
        task: (_, task) => {
          return task.newListr([
            {
              title: 'Starting infrastructure...',
              task: async () => {
                if (!await runPnpm('Start infrastructure', 'test:infra:start')) {
                  throw new Error('Infrastructure startup failed');
                }
              },
            },
            {
              title: 'Building services...',
              task: async () => {
                if (!await runPnpm('Build services', 'build:services:test')) {
                  throw new Error('Build failed');
                }
              },
            },
            {
              title: 'Starting services...',
              task: async () => {
                if (!await runPnpm('Start services', 'test:services:start')) {
                  throw new Error('Service startup failed');
                }
              },
            },
          ]);
        },
      },

      // Phase 2: Unit tests
      {
        title: 'Phase 2: Unit Tests',
        task: (_, task) => {
          return task.newListr(
            UNIT_TESTS.map((test) => ({
              title: `${test.name}...`,
              task: async (_, subtask) => {
                const timer = new Stopwatch();
                const code = await shellExec('pnpm', ['run', test.script], { cwd: PROJECT_ROOT });
                const success = code === 0;
                report.add(test.name, timer.elapsed(), success);
                subtask.title = `${test.name} ${success ? 'passed' : 'FAILED'} (${ui.formatDuration(timer.elapsed())})`;
                if (!success) throw new Error(`${test.name} failed`);
              },
            })),
            { exitOnError: false },
          );
        },
      },

      // Phase 3: Integration tests
      {
        title: 'Phase 3: Integration Tests',
        task: (_, task) => {
          return task.newListr(
            E2E_TESTS.map((test) => ({
              title: `${test.name}...`,
              task: async (_, subtask) => {
                const timer = new Stopwatch();
                const code = await shellExec('pnpm', ['run', test.script], { cwd: PROJECT_ROOT });
                const success = code === 0;
                report.add(test.name, timer.elapsed(), success);
                subtask.title = `${test.name} ${success ? 'passed' : 'FAILED'} (${ui.formatDuration(timer.elapsed())})`;
                if (!success) throw new Error(`${test.name} failed`);
              },
            })),
            { exitOnError: false },
          );
        },
      },

      // Phase 4: Cross-service E2E
      {
        title: 'Phase 4: Cross-Service E2E',
        task: async () => {
          if (!await runPnpm('Cross-Service E2E', 'test:e2e')) {
            throw new Error('Cross-service E2E failed');
          }
        },
      },

      // Phase 5: Cleanup
      {
        title: 'Phase 5: Cleanup',
        task: async () => {
          await runPnpm('Stop services', 'test:services:stop');
          await runPnpm('Stop infrastructure', 'test:infra:stop');
        },
      },
    ], { exitOnError: false });

    await tasks.run();

    // Report
    ui.step('Complete Test Suite Report');
    ui.timingTable(report.getEntries());

    const passed = report.passedCount();
    const failed = report.failedCount();
    const total = report.totalCount();

    ui.info(
      `Total time: ${pc.bold(ui.formatDuration(totalTimer.elapsed()))}\n` +
      `  Score: ${pc.bold(`${passed}/${total}`)} tests passed`,
    );

    if (failed > 0) {
      ui.done(`${failed} test(s) failed`);
      process.exit(1);
    }

    ui.done('All tests passed!');
  },
});
