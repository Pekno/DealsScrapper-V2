import * as p from '@clack/prompts';
import pc from 'picocolors';

export function banner(title: string): void {
  p.intro(pc.bgCyan(pc.black(` ${title} `)));
}

export function done(message: string): void {
  p.outro(pc.green(message));
}

export function info(message: string): void {
  p.log.info(message);
}

export function warn(message: string): void {
  p.log.warn(pc.yellow(message));
}

export function error(message: string): void {
  p.log.error(pc.red(message));
}

export function step(message: string): void {
  p.log.step(message);
}

export function success(message: string): void {
  p.log.success(pc.green(message));
}

export function serviceTable(
  services: Array<{ name: string; url: string; pid?: number; status?: string }>,
): void {
  const lines = services.map((s) => {
    const status = s.status ? (s.status === 'ok' ? pc.green('ready') : pc.red(s.status)) : '';
    const pid = s.pid ? pc.dim(`PID: ${s.pid}`) : '';
    return `  ${pc.cyan('•')} ${pc.bold(s.name.padEnd(12))} ${pc.blue(s.url.padEnd(28))} ${pid} ${status}`;
  });
  p.log.message(lines.join('\n'));
}

export function timingTable(entries: Array<{ name: string; duration: number; success: boolean }>): void {
  const lines = entries.map((e) => {
    const icon = e.success ? pc.green('✓') : pc.red('✗');
    const time = formatDuration(e.duration);
    const name = e.success ? e.name : pc.red(e.name);
    return `  ${icon} ${name.padEnd(40)} ${pc.dim(time)}`;
  });
  p.log.message(lines.join('\n'));
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  if (minutes > 0) return `${minutes}m ${remaining.toString().padStart(2, '0')}s`;
  return `${seconds}s`;
}
