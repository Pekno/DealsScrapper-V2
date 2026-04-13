import { defineCommand } from 'citty';
import { Listr, delay } from 'listr2';
import { existsSync, copyFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { composeExec, getHealthyContainerCount, shellExec } from '../lib/docker.js';
import { PROJECT_ROOT, TEST_COMPOSE_FILE, INFRA_SERVICES } from '../lib/constants.js';
import * as ui from '../lib/ui.js';

function loadEnvFile(filePath: string): NodeJS.ProcessEnv {
  const env = { ...process.env };
  if (!existsSync(filePath)) return env;
  const content = readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

export const infraStart = defineCommand({
  meta: {
    name: 'start',
    description: 'Start test infrastructure (PostgreSQL, Redis, Elasticsearch, MailHog)',
  },
  run: async () => {
    ui.banner('Start Test Infrastructure');

    const tasks = new Listr([
      {
        title: 'Preparing environment',
        task: () => {
          const envPath = resolve(PROJECT_ROOT, '.env');
          if (!existsSync(envPath)) {
            copyFileSync(resolve(PROJECT_ROOT, '.env.test'), envPath);
          }
        },
      },
      {
        title: 'Launching Docker services',
        task: () => {
          composeExec(TEST_COMPOSE_FILE, [
            'up', '-d',
            'postgres-test', 'redis-test', 'elasticsearch-test', 'mailhog-test',
          ]);
        },
      },
      {
        title: 'Waiting for services to become healthy',
        task: async (_, task) => {
          const total = INFRA_SERVICES.length;
          const timeoutMs = 60_000;
          const start = Date.now();

          while (Date.now() - start < timeoutMs) {
            const healthy = getHealthyContainerCount(TEST_COMPOSE_FILE, INFRA_SERVICES);
            task.title = `Waiting for services to become healthy (${healthy}/${total})`;

            if (healthy >= total) {
              task.title = `All infrastructure services healthy (${total}/${total})`;
              return;
            }
            await delay(3000);
          }

          throw new Error('Timeout: some services did not become healthy within 60s');
        },
      },
      {
        title: 'Pushing Prisma schema to test database',
        task: async () => {
          const env = loadEnvFile(resolve(PROJECT_ROOT, '.env.test'));
          const code = await shellExec('npx', ['prisma', 'db', 'push', '--skip-generate'], {
            cwd: resolve(PROJECT_ROOT, 'packages/database'),
            env,
          });
          if (code !== 0) throw new Error('Prisma db push failed');
        },
      },
    ]);

    await tasks.run();

    ui.serviceTable([
      { name: 'PostgreSQL', url: 'localhost:5433' },
      { name: 'Redis', url: 'localhost:6380' },
      { name: 'Elasticsearch', url: 'localhost:9201' },
      { name: 'MailHog UI', url: 'http://localhost:8025' },
    ]);

    ui.done('Infrastructure ready!');
  },
});
