import { defineCommand } from 'citty';
import { checkHealth } from '../lib/health-check.js';
import { findPidByPort, readPidFile } from '../lib/process-manager.js';
import { composeExec } from '../lib/docker.js';
import { ALL_APP_SERVICES, TEST_COMPOSE_FILE, INFRA_SERVICES } from '../lib/constants.js';
import { collectServicePorts } from '../lib/env.js';
import * as ui from '../lib/ui.js';
import pc from 'picocolors';

const SERVICE_PORTS: Record<string, number> = {
  web: 3000,
  api: 3001,
  scraper: 3002,
  notifier: 3003,
  scheduler: 3004,
};

const INFRA_DISPLAY: Record<string, { name: string; port: string }> = {
  'postgres-test': { name: 'PostgreSQL', port: '5433' },
  'redis-test': { name: 'Redis', port: '6380' },
  'elasticsearch-test': { name: 'Elasticsearch', port: '9201' },
  'mailhog-test': { name: 'MailHog', port: '8025' },
};

export const statusCommand = defineCommand({
  meta: {
    name: 'status',
    description: 'Show health dashboard for all services and infrastructure',
  },
  run: async () => {
    ui.banner('Service Status');

    // Collect dynamic ports (fallback to defaults)
    const dynamicPorts = collectServicePorts();
    for (const [name, port] of dynamicPorts) {
      SERVICE_PORTS[name] = port;
    }

    // Check app services
    const serviceResults: Array<{ name: string; url: string; pid?: number; status?: string }> = [];

    for (const name of ALL_APP_SERVICES) {
      const port = SERVICE_PORTS[name] ?? 0;
      const pid = readPidFile(name) ?? findPidByPort(port) ?? undefined;
      let status = 'stopped';

      if (pid) {
        const healthy = await checkHealth(port);
        status = healthy ? 'ok' : 'unhealthy';
      }

      serviceResults.push({
        name,
        url: `http://localhost:${port}`,
        pid,
        status,
      });
    }

    ui.step('Application Services');
    ui.serviceTable(serviceResults);

    // Check infrastructure containers
    ui.step('Infrastructure');
    const infraResults: Array<{ name: string; url: string; status?: string }> = [];

    // Get healthy count for all infra services at once
    let healthyContainers: Set<string>;
    try {
      const output = composeExec(TEST_COMPOSE_FILE, ['ps']);

      healthyContainers = new Set<string>();
      for (const service of INFRA_SERVICES) {
        const regex = new RegExp(`${service}.*\\(healthy\\)`, 'i');
        if (regex.test(output)) healthyContainers.add(service);
      }
    } catch {
      healthyContainers = new Set<string>();
    }

    for (const service of INFRA_SERVICES) {
      const display = INFRA_DISPLAY[service];
      if (!display) continue;

      infraResults.push({
        name: display.name,
        url: `localhost:${display.port}`,
        status: healthyContainers.has(service) ? 'ok' : 'stopped',
      });
    }

    ui.serviceTable(infraResults);

    // Summary
    const runningServices = serviceResults.filter((s) => s.status === 'ok').length;
    const runningInfra = infraResults.filter((s) => s.status === 'ok').length;

    ui.done(
      `Services: ${pc.bold(`${runningServices}/${serviceResults.length}`)} running | ` +
      `Infrastructure: ${pc.bold(`${runningInfra}/${infraResults.length}`)} healthy`,
    );
  },
});
