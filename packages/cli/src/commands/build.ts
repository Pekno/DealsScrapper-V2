import { defineCommand } from 'citty';
import { shellExec } from '../lib/docker.js';
import { Stopwatch } from '../lib/timing.js';
import { ALL_APP_SERVICES, PROJECT_ROOT } from '../lib/constants.js';
import * as ui from '../lib/ui.js';
import pc from 'picocolors';

type AppService = (typeof ALL_APP_SERVICES)[number];

export const buildCommand = defineCommand({
  meta: {
    name: 'build',
    description: 'Build application services',
  },
  args: {
    service: {
      type: 'string',
      description: `Target service (${ALL_APP_SERVICES.join(', ')})`,
      required: false,
    },
  },
  run: async ({ args }) => {
    const service = args.service as string | undefined;

    if (service && !ALL_APP_SERVICES.includes(service as AppService)) {
      ui.error(`Invalid service: ${service}. Valid: ${ALL_APP_SERVICES.join(', ')}`);
      process.exit(1);
    }

    const label = service ? `Build (${service})` : 'Build All';
    ui.banner(label);

    const timer = new Stopwatch();

    let code: number;
    if (service) {
      code = await shellExec('pnpm', ['turbo', 'run', 'build', `--filter=@dealscrapper/${service}`], { cwd: PROJECT_ROOT });
    } else {
      code = await shellExec('pnpm', ['run', 'build'], { cwd: PROJECT_ROOT });
    }

    const duration = ui.formatDuration(timer.elapsed());

    if (code !== 0) {
      ui.done(`Build failed (${duration})`);
      process.exit(1);
    }

    ui.done(`Build complete in ${pc.bold(duration)}!`);
  },
});
