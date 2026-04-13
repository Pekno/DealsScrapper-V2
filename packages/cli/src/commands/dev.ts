import { defineCommand } from 'citty';
import { Listr } from 'listr2';
import * as p from '@clack/prompts';
import { shellExec } from '../lib/docker.js';
import { PROJECT_ROOT } from '../lib/constants.js';
import { stopAllServices } from './services-stop.js';
import * as ui from '../lib/ui.js';

const devSetup = defineCommand({
  meta: {
    name: 'setup',
    description: 'Initialize development environment',
  },
  run: async () => {
    ui.banner('Dev Setup');

    const code = await shellExec('pnpm', ['run', 'dev:setup'], { cwd: PROJECT_ROOT });
    if (code !== 0) {
      ui.done('Dev setup failed');
      process.exit(1);
    }
    ui.done('Development environment ready!');
  },
});

const devReset = defineCommand({
  meta: {
    name: 'reset',
    description: 'Clean slate: stop services, clean, reinstall, setup',
  },
  run: async () => {
    ui.banner('Dev Reset');

    const shouldReset = await p.confirm({
      message: 'This will stop all services, clean artifacts, and reinstall. Continue?',
    });

    if (p.isCancel(shouldReset) || !shouldReset) {
      ui.warn('Aborted.');
      return;
    }

    const tasks = new Listr([
      {
        title: 'Stopping services...',
        task: async () => {
          await stopAllServices();
        },
      },
      {
        title: 'Cleaning build artifacts...',
        task: async () => {
          const code = await shellExec('pnpm', ['run', 'clean'], { cwd: PROJECT_ROOT });
          if (code !== 0) throw new Error('Clean failed');
        },
      },
      {
        title: 'Installing dependencies...',
        task: async () => {
          const code = await shellExec('pnpm', ['install'], { cwd: PROJECT_ROOT });
          if (code !== 0) throw new Error('Install failed');
        },
      },
      {
        title: 'Running dev setup...',
        task: async () => {
          const code = await shellExec('pnpm', ['run', 'dev:setup'], { cwd: PROJECT_ROOT });
          if (code !== 0) throw new Error('Dev setup failed');
        },
      },
    ]);

    await tasks.run();

    ui.done('Development environment reset complete!');
  },
});

export const devCommand = defineCommand({
  meta: { description: 'Development workflow helpers' },
  subCommands: {
    setup: devSetup,
    reset: devReset,
  },
});
