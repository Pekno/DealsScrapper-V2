import { defineCommand } from 'citty';
import { existsSync, readFileSync, watchFile, statSync, createReadStream } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { ALL_APP_SERVICES, PROJECT_ROOT } from '../lib/constants.js';
import * as ui from '../lib/ui.js';

type AppService = (typeof ALL_APP_SERVICES)[number];

function getLogPath(service: string): string {
  return resolve(PROJECT_ROOT, 'apps', service, 'logs', 'process.log');
}

function readLastLines(filePath: string, count: number): string[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  return lines.slice(-count).filter((line) => line.length > 0);
}

export const logsCommand = defineCommand({
  meta: {
    name: 'logs',
    description: 'View service logs',
  },
  args: {
    service: {
      type: 'positional',
      description: `Service name (${ALL_APP_SERVICES.join(', ')})`,
      required: true,
    },
    lines: {
      type: 'string',
      description: 'Number of lines to show',
      default: '50',
    },
    follow: {
      type: 'boolean',
      description: 'Follow log output (tail -f)',
      default: false,
    },
    err: {
      type: 'boolean',
      description: 'View error log instead',
      default: false,
    },
  },
  run: async ({ args }) => {
    const service = args.service as string;
    if (!ALL_APP_SERVICES.includes(service as AppService)) {
      ui.error(`Invalid service: ${service}. Valid: ${ALL_APP_SERVICES.join(', ')}`);
      process.exit(1);
    }

    const logFile = args.err
      ? getLogPath(service).replace('.log', '_err.log')
      : getLogPath(service);

    const logType = args.err ? 'error' : 'process';
    ui.banner(`${service} ${logType} logs`);

    if (!existsSync(logFile)) {
      ui.warn(`No log file found: ${logFile}`);
      ui.info('Start the service first with: pnpm cli services start');
      return;
    }

    const lineCount = parseInt(args.lines, 10) || 50;

    // Show last N lines
    const lastLines = readLastLines(logFile, lineCount);
    if (lastLines.length === 0) {
      ui.info('Log file is empty');
    } else {
      console.log(lastLines.join('\n'));
    }

    // Follow mode: watch for file changes using Node.js API
    if (args.follow) {
      ui.info('Following log output (press Ctrl+C to stop)...\n');

      let lastSize = statSync(logFile).size;

      watchFile(logFile, { interval: 500 }, (curr) => {
        if (curr.size > lastSize) {
          const stream = createReadStream(logFile, {
            start: lastSize,
            encoding: 'utf-8',
          });
          const rl = createInterface({ input: stream });
          rl.on('line', (line) => {
            if (line.trim()) console.log(line);
          });
          lastSize = curr.size;
        } else if (curr.size < lastSize) {
          // File was truncated/rotated
          lastSize = 0;
        }
      });

      // Keep process alive
      await new Promise(() => {});
    }
  },
});
