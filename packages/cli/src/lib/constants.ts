import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export const PROJECT_ROOT = resolve(__dirname, '..', '..', '..', '..');

export interface ServiceDefinition {
  name: string;
  port: number;
  cwd: string;
  cmd: string;
  args: string[];
  pidName: string;
}

export function getServiceDefinitions(envFile: string): ServiceDefinition[] {
  const nestCmd = 'node';
  const nestArgs = (service: string) => [`--env-file=../../${envFile}`, 'dist/main'];
  const webArgs = [`--env-file=../../${envFile}`, 'server.js'];

  return [
    {
      name: 'scheduler',
      port: 3004,
      cwd: resolve(PROJECT_ROOT, 'apps/scheduler'),
      cmd: nestCmd,
      args: nestArgs('scheduler'),
      pidName: 'scheduler',
    },
    {
      name: 'api',
      port: 3001,
      cwd: resolve(PROJECT_ROOT, 'apps/api'),
      cmd: nestCmd,
      args: nestArgs('api'),
      pidName: 'api',
    },
    {
      name: 'scraper',
      port: 3002,
      cwd: resolve(PROJECT_ROOT, 'apps/scraper'),
      cmd: nestCmd,
      args: nestArgs('scraper'),
      pidName: 'scraper',
    },
    {
      name: 'notifier',
      port: 3003,
      cwd: resolve(PROJECT_ROOT, 'apps/notifier'),
      cmd: nestCmd,
      args: nestArgs('notifier'),
      pidName: 'notifier',
    },
    {
      name: 'web',
      port: 3000,
      cwd: resolve(PROJECT_ROOT, 'apps/web'),
      cmd: nestCmd,
      args: webArgs,
      pidName: 'web',
    },
  ];
}

export const INFRA_SERVICES = [
  'postgres-test',
  'redis-test',
  'elasticsearch-test',
  'mailhog-test',
] as const;

export const TEST_COMPOSE_FILE = 'docker-compose.test.yml';
export const PROD_COMPOSE_FILE = 'docker-compose.prod.local.yml';

export const DEFAULT_IMAGE_PREFIX = 'dealscrapper';
export const ALL_APP_SERVICES = ['api', 'scraper', 'notifier', 'scheduler', 'web'] as const;

export const ENV_MAP: Record<string, { file: string; display: string }> = {
  dev: { file: '.env', display: 'Development' },
  test: { file: '.env.test', display: 'Test' },
  prod: { file: '.env.prod', display: 'Production' },
};
