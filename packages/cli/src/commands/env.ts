import { defineCommand } from 'citty';
import { resolveEnv, parseEnvFile } from '../lib/env.js';
import { ENV_MAP } from '../lib/constants.js';
import * as ui from '../lib/ui.js';
import pc from 'picocolors';

const SECRET_PATTERNS = ['PASSWORD', 'SECRET', 'KEY', 'TOKEN', 'CREDENTIAL', 'PRIVATE'];

function maskValue(key: string, value: string): string {
  const isSecret = SECRET_PATTERNS.some((pattern) => key.toUpperCase().includes(pattern));
  if (isSecret && value.length > 0) {
    return '****';
  }
  return value;
}

const REQUIRED_VARS = [
  'DATABASE_URL',
  'REDIS_HOST',
  'REDIS_PORT',
  'PORT',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'JWT_REFRESH_SECRET',
  'JWT_REFRESH_EXPIRES_IN',
  'NODE_ENV',
];

const envShow = defineCommand({
  meta: {
    name: 'show',
    description: 'Display environment variables (secrets masked)',
  },
  args: {
    env: {
      type: 'string',
      description: `Environment (${Object.keys(ENV_MAP).join(', ')})`,
      default: 'dev',
    },
  },
  run: async ({ args }) => {
    const { file, display } = resolveEnv(args.env);
    ui.banner(`Environment: ${display}`);
    ui.info(`File: ${file}`);

    const vars = parseEnvFile(file);
    const keys = Object.keys(vars);

    if (keys.length === 0) {
      ui.warn(`No variables found in ${file}`);
      return;
    }

    const lines = keys.map((key) => {
      const masked = maskValue(key, vars[key]);
      return `  ${pc.cyan(key.padEnd(35))} ${pc.dim('=')} ${masked}`;
    });

    console.log(lines.join('\n'));
    ui.done(`${keys.length} variables loaded`);
  },
});

const envValidate = defineCommand({
  meta: {
    name: 'validate',
    description: 'Check that required environment variables are set',
  },
  args: {
    env: {
      type: 'string',
      description: `Environment (${Object.keys(ENV_MAP).join(', ')})`,
      default: 'dev',
    },
  },
  run: async ({ args }) => {
    const { file, display } = resolveEnv(args.env);
    ui.banner(`Validate: ${display}`);

    const vars = parseEnvFile(file);
    let missing = 0;

    for (const required of REQUIRED_VARS) {
      if (vars[required]) {
        ui.success(`${required}`);
      } else {
        ui.error(`${required} - MISSING`);
        missing++;
      }
    }

    if (missing > 0) {
      ui.done(`${missing} required variable(s) missing`);
      process.exit(1);
    }

    ui.done('All required variables present!');
  },
});

export const envCommand = defineCommand({
  meta: { description: 'Environment configuration' },
  subCommands: {
    show: envShow,
    validate: envValidate,
  },
});
