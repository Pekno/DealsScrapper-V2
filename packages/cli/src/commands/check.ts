import { defineCommand } from 'citty';
import { Listr } from 'listr2';
import { shellExec } from '../lib/docker.js';
import { Stopwatch, TimingReport } from '../lib/timing.js';
import { ALL_APP_SERVICES, PROJECT_ROOT } from '../lib/constants.js';
import * as ui from '../lib/ui.js';
import pc from 'picocolors';

type AppService = (typeof ALL_APP_SERVICES)[number];

function validateService(service: string | undefined): AppService | undefined {
  if (!service) return undefined;
  if (!ALL_APP_SERVICES.includes(service as AppService)) {
    throw new Error(`Invalid service: ${service}. Valid: ${ALL_APP_SERVICES.join(', ')}`);
  }
  return service as AppService;
}

function turboFilter(task: string, service?: AppService, fix?: boolean): { cmd: string; args: string[] } {
  if (service) {
    const turboTask = fix ? `${task}:fix` : task;
    return { cmd: 'pnpm', args: ['turbo', 'run', turboTask, `--filter=@dealscrapper/${service}`] };
  }
  // For format, use pnpm scripts (prettier runs globally)
  if (task === 'format') {
    return { cmd: 'pnpm', args: ['run', fix ? 'format' : 'format:check'] };
  }
  return { cmd: 'pnpm', args: ['run', fix ? `${task}:fix` : task] };
}

async function runLint(service?: AppService, fix?: boolean): Promise<number> {
  const { cmd, args } = turboFilter('lint', service, fix);
  return shellExec(cmd, args, { cwd: PROJECT_ROOT });
}

async function runFormat(fix?: boolean): Promise<number> {
  const { cmd, args } = turboFilter('format', undefined, fix);
  return shellExec(cmd, args, { cwd: PROJECT_ROOT });
}

async function runTypeCheck(service?: AppService): Promise<number> {
  if (service) {
    return shellExec('pnpm', ['turbo', 'run', 'type-check', `--filter=@dealscrapper/${service}`], { cwd: PROJECT_ROOT });
  }
  return shellExec('pnpm', ['run', 'type-check'], { cwd: PROJECT_ROOT });
}

const checkLint = defineCommand({
  meta: {
    name: 'lint',
    description: 'Run ESLint',
  },
  args: {
    fix: {
      type: 'boolean',
      description: 'Auto-fix issues',
      default: false,
    },
    service: {
      type: 'string',
      description: `Target service (${ALL_APP_SERVICES.join(', ')})`,
      required: false,
    },
  },
  run: async ({ args }) => {
    const service = validateService(args.service);
    const label = service ? `Lint (${service})` : 'Lint';
    ui.banner(label);

    const code = await runLint(service, args.fix);

    if (code !== 0) {
      ui.done('Lint check failed');
      process.exit(1);
    }
    ui.done('Lint check passed!');
  },
});

const checkFormat = defineCommand({
  meta: {
    name: 'format',
    description: 'Run Prettier',
  },
  args: {
    fix: {
      type: 'boolean',
      description: 'Auto-fix formatting',
      default: false,
    },
  },
  run: async ({ args }) => {
    ui.banner('Format');

    const code = await runFormat(args.fix);

    if (code !== 0) {
      ui.done('Format check failed');
      process.exit(1);
    }
    ui.done(args.fix ? 'Formatting applied!' : 'Format check passed!');
  },
});

const checkTypes = defineCommand({
  meta: {
    name: 'types',
    description: 'Run TypeScript type checking',
  },
  args: {
    service: {
      type: 'string',
      description: `Target service (${ALL_APP_SERVICES.join(', ')})`,
      required: false,
    },
  },
  run: async ({ args }) => {
    const service = validateService(args.service);
    const label = service ? `Type Check (${service})` : 'Type Check';
    ui.banner(label);

    const code = await runTypeCheck(service);

    if (code !== 0) {
      ui.done('Type check failed');
      process.exit(1);
    }
    ui.done('Type check passed!');
  },
});

const checkAll = defineCommand({
  meta: {
    name: 'all',
    description: 'Run all code quality checks (lint, format, types)',
  },
  args: {
    fix: {
      type: 'boolean',
      description: 'Auto-fix lint and format issues',
      default: false,
    },
    service: {
      type: 'string',
      description: `Target service (${ALL_APP_SERVICES.join(', ')})`,
      required: false,
    },
  },
  run: async ({ args }) => {
    const service = validateService(args.service);
    const label = service ? `Code Quality (${service})` : 'Code Quality';
    ui.banner(label);

    const report = new TimingReport();
    const totalTimer = new Stopwatch();

    const tasks = new Listr([
      {
        title: `Lint${args.fix ? ' (fix)' : ''}...`,
        task: async (_, task) => {
          const timer = new Stopwatch();
          const code = await runLint(service, args.fix);
          const success = code === 0;
          report.add('Lint', timer.elapsed(), success);
          task.title = `Lint ${success ? 'passed' : 'FAILED'} (${ui.formatDuration(timer.elapsed())})`;
          if (!success) throw new Error('Lint failed');
        },
      },
      {
        title: `Format${args.fix ? ' (fix)' : ''}...`,
        task: async (_, task) => {
          const timer = new Stopwatch();
          const code = await runFormat(args.fix);
          const success = code === 0;
          report.add('Format', timer.elapsed(), success);
          task.title = `Format ${success ? 'passed' : 'FAILED'} (${ui.formatDuration(timer.elapsed())})`;
          if (!success) throw new Error('Format failed');
        },
      },
      {
        title: 'Type check...',
        task: async (_, task) => {
          const timer = new Stopwatch();
          const code = await runTypeCheck(service);
          const success = code === 0;
          report.add('Type Check', timer.elapsed(), success);
          task.title = `Type Check ${success ? 'passed' : 'FAILED'} (${ui.formatDuration(timer.elapsed())})`;
          if (!success) throw new Error('Type check failed');
        },
      },
    ], { exitOnError: false });

    await tasks.run();

    ui.step('Code Quality Report');
    ui.timingTable(report.getEntries());

    const passed = report.passedCount();
    const failed = report.failedCount();
    const total = report.totalCount();

    ui.info(
      `Total time: ${pc.bold(ui.formatDuration(totalTimer.elapsed()))}\n` +
      `  Score: ${pc.bold(`${passed}/${total}`)} checks passed`,
    );

    if (failed > 0) {
      ui.done(`${failed} check(s) failed`);
      process.exit(1);
    }

    ui.done('All checks passed!');
  },
});

export const checkCommand = defineCommand({
  meta: { description: 'Code quality checks (lint, format, type-check)' },
  subCommands: {
    lint: checkLint,
    format: checkFormat,
    types: checkTypes,
    all: checkAll,
  },
});
