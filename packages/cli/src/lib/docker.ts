import { execSync, spawn as cpSpawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { PROJECT_ROOT } from './constants.js';

const IS_WINDOWS = process.platform === 'win32';

/**
 * On Windows, spawn needs shell:true to resolve .cmd executables (pnpm, npx, etc).
 * To avoid DEP0190 warning, we pass the full command as a single string with no args array.
 */
function winSpawn(
  cmd: string,
  args: string[],
  options: Parameters<typeof cpSpawn>[2],
): ReturnType<typeof cpSpawn> {
  if (IS_WINDOWS) {
    const fullCmd = [cmd, ...args].map(a => (a.includes(' ') ? `"${a}"` : a)).join(' ');
    return cpSpawn(fullCmd, { ...options, shell: true });
  }
  return cpSpawn(cmd, args, options);
}

let cachedComposeCmd: string[] | null = null;

/**
 * Detect whether to use `docker compose` (V2) or `docker-compose` (V1).
 */
export function getComposeCommand(): string[] {
  if (cachedComposeCmd) return cachedComposeCmd;

  try {
    execSync('docker compose version', { stdio: 'ignore' });
    cachedComposeCmd = ['docker', 'compose'];
    return cachedComposeCmd;
  } catch {
    // V2 not available
  }

  try {
    execSync('docker-compose version', { stdio: 'ignore' });
    cachedComposeCmd = ['docker-compose'];
    return cachedComposeCmd;
  } catch {
    // V1 not available either
  }

  throw new Error("Neither 'docker compose' nor 'docker-compose' found. Is Docker installed?");
}

/**
 * Run a docker compose command and return its output.
 */
export function composeExec(
  composeFile: string,
  args: string[],
  opts?: { envFile?: string; cwd?: string; stdio?: 'pipe' | 'inherit' },
): string {
  const cmd = getComposeCommand();
  const fullArgs = [...cmd.slice(1), '-f', resolve(PROJECT_ROOT, composeFile), ...args];
  const envArgs = opts?.envFile ? ['--env-file', opts.envFile] : [];

  const result = execSync(
    [cmd[0], ...envArgs, ...fullArgs].join(' '),
    {
      cwd: opts?.cwd ?? PROJECT_ROOT,
      encoding: 'utf-8',
      stdio: opts?.stdio === 'inherit' ? 'inherit' : ['pipe', 'pipe', 'pipe'],
    },
  );

  return typeof result === 'string' ? result : '';
}

/**
 * Run a docker compose command with inherited stdio (streams output to terminal).
 */
export function composeRun(
  composeFile: string,
  args: string[],
  opts?: { envFile?: string },
): Promise<number> {
  return new Promise((resolve, reject) => {
    const cmd = getComposeCommand();
    const fullArgs = [...cmd.slice(1), '-f', composeFile];
    if (opts?.envFile) fullArgs.push('--env-file', opts.envFile);
    fullArgs.push(...args);

    const child = winSpawn(cmd[0], fullArgs, {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
    });

    child.on('close', (code) => resolve(code ?? 0));
    child.on('error', reject);
  });
}

/**
 * Run a shell command with inherited stdio and return its exit code.
 */
export function shellExec(cmd: string, args: string[], opts?: { cwd?: string; env?: NodeJS.ProcessEnv }): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = winSpawn(cmd, args, {
      cwd: opts?.cwd ?? PROJECT_ROOT,
      stdio: 'inherit',
      env: opts?.env,
    });

    child.on('close', (code) => resolve(code ?? 0));
    child.on('error', reject);
  });
}

/**
 * Run a shell command, capture output, return { code, stdout, stderr }.
 */
export function shellCapture(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; env?: NodeJS.ProcessEnv },
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolvePromise) => {
    const child = winSpawn(cmd, args, {
      cwd: opts?.cwd ?? PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: opts?.env,
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d: Buffer) => (stdout += d.toString()));
    child.stderr?.on('data', (d: Buffer) => (stderr += d.toString()));

    child.on('close', (code) => resolvePromise({ code: code ?? 1, stdout, stderr }));
    child.on('error', () => resolvePromise({ code: 1, stdout, stderr }));
  });
}

/**
 * Check if containers matching the given names are healthy via docker compose ps.
 */
export function getHealthyContainerCount(composeFile: string, serviceNames: readonly string[]): number {
  try {
    const output = composeExec(composeFile, ['ps']);
    let healthy = 0;
    for (const service of serviceNames) {
      // Match lines containing the service name and "(healthy)"
      const regex = new RegExp(`${service}.*\\(healthy\\)`, 'i');
      if (regex.test(output)) healthy++;
    }
    return healthy;
  } catch {
    return 0;
  }
}
