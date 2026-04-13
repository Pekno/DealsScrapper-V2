import { defineCommand } from 'citty';
import { Listr } from 'listr2';
import { composeExec } from '../lib/docker.js';
import { TEST_COMPOSE_FILE } from '../lib/constants.js';
import * as ui from '../lib/ui.js';

export const infraStop = defineCommand({
  meta: {
    name: 'stop',
    description: 'Stop test infrastructure containers',
  },
  run: async () => {
    ui.banner('Stop Test Infrastructure');

    const tasks = new Listr([
      {
        title: 'Stopping Docker services...',
        task: () => {
          composeExec(TEST_COMPOSE_FILE, ['stop']);
        },
      },
    ]);

    await tasks.run();
    ui.done('Infrastructure stopped');
  },
});
