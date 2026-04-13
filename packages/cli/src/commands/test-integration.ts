import { defineCommand } from 'citty';
import { Listr } from 'listr2';
import { shellExec } from '../lib/docker.js';
import { Stopwatch, TimingReport } from '../lib/timing.js';
import { PROJECT_ROOT } from '../lib/constants.js';
import * as ui from '../lib/ui.js';
import pc from 'picocolors';

const E2E_TEST_SERVICES = [
  { name: 'API', script: 'test:api:e2e' },
  { name: 'Scraper', script: 'test:scraper:e2e' },
  { name: 'Notifier', script: 'test:notifier:e2e' },
  { name: 'Scheduler', script: 'test:scheduler:e2e' },
];

export const testIntegration = defineCommand({
  meta: {
    name: 'integration',
    description: 'Run integration (E2E) tests for all services',
  },
  run: async () => {
    ui.banner('Integration Tests - All Services');

    const report = new TimingReport();
    const totalTimer = new Stopwatch();

    const tasks = new Listr(
      E2E_TEST_SERVICES.map((service) => ({
        title: `${service.name} E2E tests...`,
        task: async (_, task) => {
          const timer = new Stopwatch();
          const code = await shellExec('pnpm', ['run', service.script], { cwd: PROJECT_ROOT });
          const duration = timer.elapsed();
          const success = code === 0;

          report.add(service.name, duration, success);
          task.title = `${service.name} E2E tests ${success ? 'passed' : 'FAILED'} (${ui.formatDuration(duration)})`;

          if (!success) throw new Error(`${service.name} E2E tests failed`);
        },
      })),
      { exitOnError: false },
    );

    await tasks.run();

    ui.step('Integration Tests Summary');
    ui.timingTable(report.getEntries());
    ui.info(
      `Total: ${pc.bold(ui.formatDuration(totalTimer.elapsed()))} | ` +
      `${pc.green(`${report.passedCount()} passed`)} | ` +
      `${report.failedCount() > 0 ? pc.red(`${report.failedCount()} failed`) : pc.dim('0 failed')}`,
    );

    if (report.failedCount() > 0) {
      ui.done('Some integration tests failed');
      process.exit(1);
    }

    ui.done('All integration tests passed!');
  },
});
