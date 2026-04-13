import { defineCommand } from 'citty';
import { Listr } from 'listr2';
import { shellExec } from '../lib/docker.js';
import { ALL_APP_SERVICES, DEFAULT_IMAGE_PREFIX } from '../lib/constants.js';
import { Stopwatch } from '../lib/timing.js';
import * as ui from '../lib/ui.js';
import pc from 'picocolors';

export const dockerBuild = defineCommand({
  meta: {
    name: 'build',
    description: 'Build Docker images for all services',
  },
  args: {
    prefix: {
      type: 'string',
      description: 'Image prefix for registry',
      default: DEFAULT_IMAGE_PREFIX,
    },
    version: {
      type: 'string',
      description: 'Image version tag',
      default: 'latest',
    },
    platforms: {
      type: 'string',
      description: 'Target platforms (e.g. linux/amd64,linux/arm64)',
      default: 'linux/amd64',
    },
    push: {
      type: 'boolean',
      description: 'Push images to registry after build',
      default: false,
    },
    service: {
      type: 'string',
      description: 'Build only a specific service',
    },
  },
  run: async ({ args }) => {
    const services = args.service
      ? [args.service]
      : [...ALL_APP_SERVICES];
    const isMultiPlatform = args.platforms.includes(',');

    ui.banner('Docker Image Build');

    ui.info(
      `Prefix: ${pc.bold(args.prefix)}\n` +
      `  Version: ${pc.bold(args.version)}\n` +
      `  Platforms: ${pc.bold(args.platforms)}\n` +
      `  Push: ${pc.bold(String(args.push))}\n` +
      `  Services: ${pc.bold(services.join(', '))}`,
    );

    // Check for buildx if multi-platform
    if (isMultiPlatform) {
      const code = await shellExec('docker', ['buildx', 'version']);
      if (code !== 0) {
        throw new Error('Docker buildx is required for multi-platform builds');
      }
    }

    const totalTimer = new Stopwatch();
    const results: Array<{ name: string; duration: number; success: boolean }> = [];

    const tasks = new Listr(
      services.map((service) => ({
        title: `Building ${service}...`,
        task: async (_, task) => {
          const timer = new Stopwatch();

          const buildArgs: string[] = [
            'build',
            '-f', 'Dockerfile.global',
            '--build-arg', `SERVICE=${service}`,
            '--build-arg', 'PNPM_VERSION=10.12.4',
            '-t', `${args.prefix}/${service}:${args.version}`,
          ];

          if (args.version !== 'latest') {
            buildArgs.push('-t', `${args.prefix}/${service}:latest`);
          }

          if (isMultiPlatform) {
            buildArgs.unshift('buildx');
            buildArgs.push('--platform', args.platforms);
            buildArgs.push(args.push ? '--push' : '--load');
          }

          buildArgs.push('.');

          const code = await shellExec('docker', buildArgs);

          const duration = timer.elapsed();

          if (code !== 0) {
            results.push({ name: service, duration, success: false });
            throw new Error(`Build failed for ${service}`);
          }

          // Push if single platform and push flag
          if (args.push && !isMultiPlatform) {
            task.title = `Pushing ${service}...`;
            await shellExec('docker', ['push', `${args.prefix}/${service}:${args.version}`]);
            if (args.version !== 'latest') {
              await shellExec('docker', ['push', `${args.prefix}/${service}:latest`]);
            }
          }

          results.push({ name: service, duration, success: true });
          task.title = `${service} built (${ui.formatDuration(duration)})`;
        },
      })),
    );

    await tasks.run();

    ui.step('Build Summary');
    ui.timingTable(results);
    ui.info(`Total time: ${pc.bold(ui.formatDuration(totalTimer.elapsed()))}`);

    if (args.push) {
      ui.success('Images pushed to registry');
    }

    ui.done('All images built successfully!');
  },
});
