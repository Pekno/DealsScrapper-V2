import { defineCommand } from 'citty';
import { Listr } from 'listr2';
import { shellExec } from '../lib/docker.js';
import { Stopwatch, TimingReport } from '../lib/timing.js';
import { PROJECT_ROOT } from '../lib/constants.js';
import * as ui from '../lib/ui.js';
import pc from 'picocolors';

const UNIT_TEST_SERVICES = [
  { name: 'API', script: 'test:api:unit' },
  { name: 'Scraper', script: 'test:scraper:unit' },
  { name: 'Notifier', script: 'test:notifier:unit' },
  { name: 'Scheduler', script: 'test:scheduler:unit' },
];

export const testUnit = defineCommand({
  meta: {
    name: 'unit',
    description: 'Run unit tests for all services',
  },
  run: async () => {
    ui.banner('Unit Tests - All Services');

    const report = new TimingReport();
    const totalTimer = new Stopwatch();

    const tasks = new Listr(
      UNIT_TEST_SERVICES.map((service) => ({
        title: `${service.name} unit tests...`,
        task: async (_, task) => {
          const timer = new Stopwatch();
          const code = await shellExec('pnpm', ['run', service.script], { cwd: PROJECT_ROOT });
          const duration = timer.elapsed();
          const success = code === 0;

          report.add(service.name, duration, success);
          task.title = `${service.name} unit tests ${success ? 'passed' : 'FAILED'} (${ui.formatDuration(duration)})`;

          if (!success) throw new Error(`${service.name} unit tests failed`);
        },
      })),
      { exitOnError: false },
    );

    await tasks.run();

    ui.step('Unit Tests Summary');
    ui.timingTable(report.getEntries());
    ui.info(
      `Total: ${pc.bold(ui.formatDuration(totalTimer.elapsed()))} | ` +
      `${pc.green(`${report.passedCount()} passed`)} | ` +
      `${report.failedCount() > 0 ? pc.red(`${report.failedCount()} failed`) : pc.dim('0 failed')}`,
    );

    if (report.failedCount() > 0) {
      ui.done('Some unit tests failed');
      process.exit(1);
    }

    ui.done('All unit tests passed!');
  },
});
