import { defineCommand } from 'citty';
import { Listr, delay } from 'listr2';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { composeRun, shellCapture } from '../lib/docker.js';
import { PROJECT_ROOT, PROD_COMPOSE_FILE } from '../lib/constants.js';
import * as ui from '../lib/ui.js';

const COMPOSE_OPTS = { envFile: '.env.prod' };

export const deployProd = defineCommand({
  meta: {
    name: 'deploy',
    description: 'Production deployment management',
  },
  args: {
    _: {
      type: 'positional',
      description: 'Docker compose command (up, down, logs, ps, build, ...)',
      required: true,
    },
  },
  run: async ({ args }) => {
    const envProdPath = resolve(PROJECT_ROOT, '.env.prod');
    if (!existsSync(envProdPath)) {
      throw new Error('.env.prod not found! Please create it with production configuration.');
    }

    // Parse the positional args - citty gives us the first positional, rest in rawArgs
    const rawArgs = process.argv.slice(process.argv.indexOf('deploy') + 1);
    const command = rawArgs[0];
    const restArgs = rawArgs.slice(1);

    if (command === 'up') {
      await deployUp();
    } else {
      // Passthrough to docker compose for all other commands
      ui.banner('DealsScrapper Production');
      await composeRun(PROD_COMPOSE_FILE, [command, ...restArgs], COMPOSE_OPTS);
    }
  },
});

async function deployUp(): Promise<void> {
  ui.banner('DealsScrapper Production Deployment');

  const tasks = new Listr([
    {
      title: 'Step 1/3: Starting infrastructure (PostgreSQL, Redis, Elasticsearch)',
      task: async () => {
        await composeRun(PROD_COMPOSE_FILE, ['up', '-d', 'postgres', 'redis', 'elasticsearch'], COMPOSE_OPTS);
      },
    },
    {
      title: 'Step 2/3: Waiting for infrastructure health',
      task: (_, task) => {
        return task.newListr([
          {
            title: 'PostgreSQL...',
            task: async (_, subtask) => {
              await waitForComposeExec('postgres', 'pg_isready -U dealscrapper');
              subtask.title = 'PostgreSQL ready';
            },
          },
          {
            title: 'Redis...',
            task: async (_, subtask) => {
              await waitForComposeExec('redis', 'redis-cli --no-auth-warning -a $REDIS_PASSWORD ping');
              subtask.title = 'Redis ready';
            },
          },
          {
            title: 'Elasticsearch...',
            task: async (_, subtask) => {
              await waitForComposeExec('elasticsearch', 'curl -sf http://localhost:9200/_cluster/health');
              subtask.title = 'Elasticsearch ready';
            },
          },
        ], { concurrent: true });
      },
    },
    {
      title: 'Step 3/3: Starting application services',
      task: async () => {
        await composeRun(
          PROD_COMPOSE_FILE,
          ['up', '-d', 'api', 'notifier', 'scraper-dealabs', 'scraper-vinted', 'scraper-leboncoin', 'scheduler', 'web'],
          COMPOSE_OPTS,
        );
      },
    },
  ]);

  await tasks.run();

  ui.serviceTable([
    { name: 'Web', url: 'http://localhost:3000' },
    { name: 'API', url: 'http://localhost:3001' },
    { name: 'Notifier', url: 'ws://localhost:3003' },
  ]);

  ui.done('DealsScrapper Production is running!');
}

async function waitForComposeExec(
  service: string,
  command: string,
  maxRetries = 30,
  intervalMs = 2000,
): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    const { code } = await shellCapture(
      'docker',
      ['compose', '-f', PROD_COMPOSE_FILE, '--env-file', '.env.prod', 'exec', '-T', service, 'sh', '-c', command],
      { cwd: PROJECT_ROOT },
    );
    if (code === 0) return;
    await delay(intervalMs);
  }
  throw new Error(`${service} did not become healthy`);
}
