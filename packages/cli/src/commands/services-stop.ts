import { defineCommand } from 'citty';
import {
  readPidFile,
  removePidFile,
  isProcessRunning,
  killProcess,
  findPidByPort,
} from '../lib/process-manager.js';
import { collectServicePorts } from '../lib/env.js';
import { ALL_APP_SERVICES } from '../lib/constants.js';
import * as ui from '../lib/ui.js';

/**
 * Stop all services. Exported so services-start can call it on failure.
 */
export async function stopAllServices(): Promise<number> {
  const stoppedServices = new Set<string>();
  let count = 0;

  // Method 1: Stop by PID files
  for (const service of ALL_APP_SERVICES) {
    const pid = readPidFile(service);
    if (pid !== null && isProcessRunning(pid)) {
      killProcess(pid);
      stoppedServices.add(service);
      count++;
    }
    removePidFile(service);
  }

  // Method 2: Stop orphaned processes by port
  const ports = collectServicePorts();
  for (const [service, port] of ports) {
    if (stoppedServices.has(service)) continue;

    const pid = findPidByPort(port);
    if (pid !== null) {
      ui.info(`Stopping ${service} (orphaned on port ${port})`);
      killProcess(pid);
      count++;
    }
  }

  return count;
}

export const servicesStop = defineCommand({
  meta: {
    name: 'stop',
    description: 'Stop all application services',
  },
  run: async () => {
    ui.banner('Stop Application Services');

    const count = await stopAllServices();

    if (count === 0) {
      ui.info('No running services found');
    } else {
      ui.success(`Stopped ${count} service(s)`);
    }

    ui.done('All services stopped');
  },
});
