import { defineCommand } from 'citty';
import { resolve } from 'node:path';
import * as p from '@clack/prompts';
import { shellExec } from '../lib/docker.js';
import { resolveEnv } from '../lib/env.js';
import { PROJECT_ROOT } from '../lib/constants.js';
import * as ui from '../lib/ui.js';

const DB_CWD = resolve(PROJECT_ROOT, 'packages/database');

const dbGenerate = defineCommand({
  meta: {
    name: 'generate',
    description: 'Generate Prisma client',
  },
  run: async () => {
    ui.banner('Prisma Generate');
    const code = await shellExec('pnpm', ['run', 'db:generate'], { cwd: PROJECT_ROOT });
    if (code !== 0) {
      ui.done('Prisma generate failed');
      process.exit(1);
    }
    ui.done('Prisma client generated!');
  },
});

const dbMigrate = defineCommand({
  meta: {
    name: 'migrate',
    description: 'Run Prisma migrations',
  },
  args: {
    env: {
      type: 'string',
      description: 'Environment (dev, test, prod)',
      default: 'dev',
    },
  },
  run: async ({ args }) => {
    const { display } = resolveEnv(args.env);
    ui.banner(`Prisma Migrate (${display})`);
    const code = await shellExec('pnpm', ['run', 'db:migrate'], { cwd: PROJECT_ROOT });
    if (code !== 0) {
      ui.done('Prisma migrate failed');
      process.exit(1);
    }
    ui.done('Migrations applied!');
  },
});

const dbPush = defineCommand({
  meta: {
    name: 'push',
    description: 'Push Prisma schema to database',
  },
  args: {
    env: {
      type: 'string',
      description: 'Environment (dev, test, prod)',
      default: 'dev',
    },
  },
  run: async ({ args }) => {
    const { display } = resolveEnv(args.env);
    ui.banner(`Prisma Push (${display})`);

    const code = await shellExec('npx', ['prisma', 'db', 'push'], { cwd: DB_CWD });
    if (code !== 0) {
      ui.done('Prisma db push failed');
      process.exit(1);
    }
    ui.done('Schema pushed!');
  },
});

const dbStudio = defineCommand({
  meta: {
    name: 'studio',
    description: 'Open Prisma Studio',
  },
  run: async () => {
    ui.banner('Prisma Studio');
    ui.info('Starting Prisma Studio (press Ctrl+C to stop)');
    await shellExec('pnpm', ['run', 'db:studio'], { cwd: PROJECT_ROOT });
  },
});

const dbSeed = defineCommand({
  meta: {
    name: 'seed',
    description: 'Seed the database',
  },
  run: async () => {
    ui.banner('Database Seed');
    const code = await shellExec('pnpm', ['run', 'db:seed'], { cwd: PROJECT_ROOT });
    if (code !== 0) {
      ui.done('Database seeding failed');
      process.exit(1);
    }
    ui.done('Database seeded!');
  },
});

const dbReset = defineCommand({
  meta: {
    name: 'reset',
    description: 'Reset the database (DESTRUCTIVE)',
  },
  run: async () => {
    ui.banner('Database Reset');

    const shouldReset = await p.confirm({
      message: 'This will DESTROY all data in the database. Are you sure?',
    });

    if (p.isCancel(shouldReset) || !shouldReset) {
      ui.warn('Aborted.');
      return;
    }

    const code = await shellExec('pnpm', ['run', 'db:reset'], { cwd: PROJECT_ROOT });
    if (code !== 0) {
      ui.done('Database reset failed');
      process.exit(1);
    }
    ui.done('Database reset complete!');
  },
});

export const dbCommand = defineCommand({
  meta: { description: 'Database management (Prisma)' },
  subCommands: {
    generate: dbGenerate,
    migrate: dbMigrate,
    push: dbPush,
    studio: dbStudio,
    seed: dbSeed,
    reset: dbReset,
  },
});
