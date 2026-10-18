import pkg from '@slack/bolt';
const { App } = pkg;
import { env } from './config/env.js';
import { registerCommandHandlers } from './slack/handlers/commands.js';
import { registerActionHandlers } from './slack/handlers/actions.js';
import { registerViewHandlers } from './slack/handlers/views.js';
import { registerEventHandlers } from './slack/handlers/events.js';

const isSocketMode = Boolean(env.SLACK_APP_TOKEN && env.NODE_ENV === 'development');

const customRoutes = [
  {
    path: '/healthz',
    method: ['GET', 'HEAD'],
    handler: (_req: any, res: any) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (_req.method === 'HEAD') {
        res.end();
        return;
      }
      res.end(
        JSON.stringify({
          status: 'ok',
          app: 'pollito',
          timestamp: new Date().toISOString(),
        })
      );
    },
  },
];

export const app = new App(
  isSocketMode
    ? {
        token: env.SLACK_BOT_TOKEN,
        appToken: env.SLACK_APP_TOKEN,
        socketMode: true,
        customRoutes,
      }
    : {
        token: env.SLACK_BOT_TOKEN,
        signingSecret: env.SLACK_SIGNING_SECRET,
        port: env.PORT,
        customRoutes,
      }
);

import { PollTimerWorker } from './workers/pollTimerWorker.js';

registerCommandHandlers(app);
registerActionHandlers(app);
registerViewHandlers(app);
registerEventHandlers(app);

export const pollTimerWorker = new PollTimerWorker(app, 30000);

async function startServer() {
  if (isSocketMode) {
    await app.start();
  } else {
    await app.start(env.PORT);
  }
  
  pollTimerWorker.start();

  console.log(
    `🐣 Pollito Slack Bot is running in ${env.NODE_ENV} mode (${
      isSocketMode ? 'Socket Mode' : `HTTP port ${env.PORT}`
    }) with background deadline timer active`
  );
}

process.on('SIGTERM', () => {
  pollTimerWorker.stop();
});
process.on('SIGINT', () => {
  pollTimerWorker.stop();
});

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('Fatal error starting Pollito:', err);
    process.exit(1);
  });
}
