import { defineCommand } from 'citty';
import { Listr, delay } from 'listr2';
import { resolve } from 'node:path';
import { spawnDetached } from '../lib/process-manager.js';
import { waitForHealth } from '../lib/health-check.js';
import { resolveEnv, ensureEnvFile } from '../lib/env.js';
import { PROJECT_ROOT, getServiceDefinitions } from '../lib/constants.js';
import * as ui from '../lib/ui.js';
import pc from 'picocolors';

export const servicesStart = defineCommand({
  meta: {
    name: 'start',
    description: 'Start application services',
  },
  args: {
    env: {
      type: 'string',
      description: 'Environment (dev, test, prod)',
      default: 'test',
    },
  },
  run: async ({ args }) => {
    const env = resolveEnv(args.env);
    ensureEnvFile(env.file);

    ui.banner(`Start Application Services (${env.display})`);
    ui.info(`Environment: ${pc.bold(env.display)} (${env.file})`);

    const services = getServiceDefinitions(env.file);
    const scheduler = services.find((s) => s.name === 'scheduler')!;
    const remaining = services.filter((s) => s.name !== 'scheduler');

    const schedulerTimeoutMs = process.env.CI ? 120_000 : 60_000;
    const serviceTimeoutMs = 90_000;

    const tasks = new Listr([
      {
        title: 'Phase 1: Start scheduler (required for worker registration)',
        task: (_, task) => {
          return task.newListr([
            {
              title: `Starting ${scheduler.name}...`,
              task: () => {
                const pid = spawnDetached({
                  cmd: scheduler.cmd,
                  args: scheduler.args,
                  cwd: scheduler.cwd,
                  logFile: resolve(scheduler.cwd, 'logs/process.log'),
                  pidName: scheduler.pidName,
                });
                task.output = `Scheduler started (PID: ${pid})`;
              },
            },
            {
              title: `Waiting for scheduler on port ${scheduler.port}...`,
              task: async (_, subtask) => {
                const ok = await waitForHealth({
                  port: scheduler.port,
                  timeoutMs: schedulerTimeoutMs,
                  onTick: (elapsed) => {
                    subtask.title = `Waiting for scheduler on port ${scheduler.port}... (${Math.floor(elapsed / 1000)}s)`;
                  },
                });
                if (!ok) {
                  throw new Error(
                    `Scheduler failed to start within ${schedulerTimeoutMs / 1000}s. ` +
                    `Check logs: apps/scheduler/logs/process.log`,
                  );
                }
                subtask.title = `Scheduler ready on port ${scheduler.port}`;
              },
            },
          ]);
        },
      },
      {
        title: 'Phase 2: Start remaining services',
        task: (_, task) => {
          return task.newListr(
            remaining.map((service) => ({
              title: `Starting ${service.name}...`,
              task: async (_, subtask) => {
                const pid = spawnDetached({
                  cmd: service.cmd,
                  args: service.args,
                  cwd: service.cwd,
                  logFile: resolve(service.cwd, 'logs/process.log'),
                  pidName: service.pidName,
                });

                subtask.title = `Waiting for ${service.name} on port ${service.port}...`;

                const ok = await waitForHealth({
                  port: service.port,
                  timeoutMs: serviceTimeoutMs,
                  onTick: (elapsed) => {
                    subtask.title = `Waiting for ${service.name} on port ${service.port}... (${Math.floor(elapsed / 1000)}s)`;
                  },
                });

                if (!ok) {
                  throw new Error(
                    `${service.name} failed to start within ${serviceTimeoutMs / 1000}s. ` +
                    `Check logs: apps/${service.name}/logs/process.log`,
                  );
                }

                subtask.title = `${service.name} ready (PID: ${pid})`;
              },
            })),
            { concurrent: true },
          );
        },
      },
    ]);

    try {
      await tasks.run();
    } catch (err) {
      ui.error('Service startup failed. Stopping all services...');
      // Dynamic import to avoid circular dependency
      const { stopAllServices } = await import('./services-stop.js');
      await stopAllServices();
      throw err;
    }

    ui.serviceTable(
      services.map((s) => ({
        name: s.name,
        url: `http://localhost:${s.port}`,
      })),
    );

    ui.info(`Process logs: ${pc.dim('apps/{service}/logs/process.log')}`);
    ui.done('All services started!');
  },
});
