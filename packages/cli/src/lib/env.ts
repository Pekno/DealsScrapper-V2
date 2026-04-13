import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PROJECT_ROOT, ENV_MAP } from './constants.js';

export function resolveEnv(env: string): { file: string; display: string } {
  const entry = ENV_MAP[env];
  if (!entry) {
    throw new Error(`Invalid environment: ${env}. Valid: ${Object.keys(ENV_MAP).join(', ')}`);
  }
  return entry;
}

export function ensureEnvFile(envFile: string): string {
  const fullPath = resolve(PROJECT_ROOT, envFile);
  if (!existsSync(fullPath)) {
    throw new Error(`Environment file not found: ${envFile}`);
  }
  return fullPath;
}

export function parseEnvFile(envFile: string): Record<string, string> {
  const fullPath = resolve(PROJECT_ROOT, envFile);
  if (!existsSync(fullPath)) return {};

  const content = readFileSync(fullPath, 'utf-8');
  const vars: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

/**
 * Collect all service ports from all env files.
 */
export function collectServicePorts(): Map<string, number> {
  const ports = new Map<string, number>();
  const envFiles = ['.env', '.env.test', '.env.prod'];

  for (const envFile of envFiles) {
    const vars = parseEnvFile(envFile);

    if (vars['PORT']) ports.set('api', parseInt(vars['PORT'], 10));
    if (vars['SCRAPER_PORT']) ports.set('scraper', parseInt(vars['SCRAPER_PORT'], 10));
    if (vars['NOTIFIER_PORT']) ports.set('notifier', parseInt(vars['NOTIFIER_PORT'], 10));
    if (vars['SCHEDULER_PORT']) ports.set('scheduler', parseInt(vars['SCHEDULER_PORT'], 10));

    // Extract web port from FRONTEND_URL
    if (vars['FRONTEND_URL']) {
      const match = vars['FRONTEND_URL'].match(/:(\d+)/);
      if (match) ports.set('web', parseInt(match[1], 10));
    }
  }

  // Defaults if nothing found
  if (ports.size === 0) {
    ports.set('api', 3001);
    ports.set('scraper', 3002);
    ports.set('notifier', 3003);
    ports.set('scheduler', 3004);
    ports.set('web', 3000);
  }

  return ports;
}
