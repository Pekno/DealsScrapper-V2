import { spawn, execSync } from 'node:child_process';
import { openSync, readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const IS_WINDOWS = process.platform === 'win32';

function pidFilePath(name: string): string {
  return join(tmpdir(), `dealscrapper-${name}.pid`);
}

/**
 * Spawn a detached background process, write its PID to a file.
 * Works cross-platform: detached:true creates a new process group on both Windows and Linux.
 */
export function spawnDetached(opts: {
  cmd: string;
  args: string[];
  cwd: string;
  logFile: string;
  pidName: string;
}): number {
  // Ensure log directory exists
  const logDir = dirname(opts.logFile);
  mkdirSync(logDir, { recursive: true });

  const out = openSync(opts.logFile, 'w');
  const errLogFile = opts.logFile.replace('.log', '_err.log');
  const err = openSync(errLogFile, 'w');

  let child;
  if (IS_WINDOWS) {
    const fullCmd = [opts.cmd, ...opts.args].map(a => (a.includes(' ') ? `"${a}"` : a)).join(' ');
    child = spawn(fullCmd, {
      cwd: opts.cwd,
      detached: true,
      stdio: ['ignore', out, err],
      shell: true,
    });
  } else {
    child = spawn(opts.cmd, opts.args, {
      cwd: opts.cwd,
      detached: true,
      stdio: ['ignore', out, err],
    });
  }

  child.unref();

  const pid = child.pid!;
  writePidFile(opts.pidName, pid);
  return pid;
}

export function writePidFile(name: string, pid: number): void {
  writeFileSync(pidFilePath(name), String(pid), 'utf-8');
}

export function readPidFile(name: string): number | null {
  const path = pidFilePath(name);
  if (!existsSync(path)) return null;
  const content = readFileSync(path, 'utf-8').trim();
  const pid = parseInt(content, 10);
  return isNaN(pid) ? null : pid;
}

export function removePidFile(name: string): void {
  const path = pidFilePath(name);
  try {
    unlinkSync(path);
  } catch {
    // Already removed
  }
}

/**
 * Check if a process with the given PID is still running.
 */
export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0); // Signal 0 = existence check
    return true;
  } catch {
    return false;
  }
}

/**
 * Kill a process by PID. Returns true if the process was killed.
 */
export function killProcess(pid: number): boolean {
  try {
    if (IS_WINDOWS) {
      // On Windows, SIGTERM doesn't work reliably. Use taskkill for clean shutdown.
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      // Send SIGTERM first, then SIGKILL if still alive
      process.kill(pid, 'SIGTERM');
      // Give it a moment to shut down
      try {
        execSync('sleep 0.3');
      } catch { /* ignore */ }
      if (isProcessRunning(pid)) {
        process.kill(pid, 'SIGKILL');
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Find the PID of a process listening on a given port.
 * This is the one place with platform-specific branching.
 */
export function findPidByPort(port: number): number | null {
  try {
    if (IS_WINDOWS) {
      const output = execSync(
        `netstat -ano | findstr :${port} | findstr LISTENING`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] },
      );
      // Output format: TCP    0.0.0.0:3001    0.0.0.0:0    LISTENING    12345
      const lines = output.trim().split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(pid) && pid > 0) return pid;
      }
    } else {
      const output = execSync(
        `ss -tlnp 2>/dev/null | grep ":${port} "`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] },
      );
      const match = output.match(/pid=(\d+)/);
      if (match) return parseInt(match[1], 10);
    }
  } catch {
    // Command failed or no process found
  }
  return null;
}

/**
 * Read the last N lines from a log file and find error messages.
 */
export function extractRecentError(logFile: string, lines = 30): string | null {
  try {
    if (!existsSync(logFile)) return null;
    const content = readFileSync(logFile, 'utf-8');
    const allLines = content.split('\n');
    const recentLines = allLines.slice(-lines);
    const errorPattern = /error|exception|failed|cannot find|ECONNREFUSED/i;
    const falsePositivePattern = /Found 0 errors|0 errors\./;

    for (let i = recentLines.length - 1; i >= 0; i--) {
      const line = recentLines[i];
      if (errorPattern.test(line) && !falsePositivePattern.test(line)) {
        // Strip ANSI escape codes
        return line.replace(/\x1b\[[0-9;]*m/g, '').trim();
      }
    }
  } catch {
    // File read error
  }
  return null;
}
