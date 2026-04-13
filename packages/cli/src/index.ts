import { defineCommand, runMain } from 'citty';
import { infraStart } from './commands/infra-start.js';
import { infraStop } from './commands/infra-stop.js';
import { servicesStart } from './commands/services-start.js';
import { servicesStop } from './commands/services-stop.js';
import { dockerBuild } from './commands/docker-build.js';
import { deployProd } from './commands/deploy-prod.js';
import { testUnit } from './commands/test-unit.js';
import { testIntegration } from './commands/test-integration.js';
import { testComplete } from './commands/test-complete.js';
import { checkCommand } from './commands/check.js';
import { dbCommand } from './commands/db.js';
import { statusCommand } from './commands/status.js';
import { logsCommand } from './commands/logs.js';
import { buildCommand } from './commands/build.js';
import { devCommand } from './commands/dev.js';
import { envCommand } from './commands/env.js';

const main = defineCommand({
  meta: {
    name: 'dealscrapper',
    version: '1.0.0',
    description: 'DealsScapper development CLI',
  },
  subCommands: {
    infra: defineCommand({
      meta: { description: 'Manage test infrastructure (Docker containers)' },
      subCommands: {
        start: infraStart,
        stop: infraStop,
      },
    }),
    services: defineCommand({
      meta: { description: 'Manage application services' },
      subCommands: {
        start: servicesStart,
        stop: servicesStop,
      },
    }),
    docker: defineCommand({
      meta: { description: 'Docker image management' },
      subCommands: {
        build: dockerBuild,
      },
    }),
    deploy: deployProd,
    test: defineCommand({
      meta: { description: 'Run test suites' },
      subCommands: {
        unit: testUnit,
        integration: testIntegration,
        complete: testComplete,
      },
    }),
    check: checkCommand,
    db: dbCommand,
    status: statusCommand,
    logs: logsCommand,
    build: buildCommand,
    dev: devCommand,
    env: envCommand,
  },
});

runMain(main);
