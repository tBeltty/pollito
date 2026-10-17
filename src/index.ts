import pkg from '@slack/bolt';
const { App } = pkg;
import { env } from './config/env.js';
import { registerCommandHandlers } from './slack/handlers/commands.js';
import { registerActionHandlers } from './slack/handlers/actions.js';
import { registerViewHandlers } from './slack/handlers/views.js';
import { registerEventHandlers } from './slack/handlers/events.js';

const isSocketMode = Boolean(env.SLACK_APP_TOKEN && env.NODE_ENV === 'development');

export const app = new App(
  isSocketMode
    ? {
        token: env.SLACK_BOT_TOKEN,
        appToken: env.SLACK_APP_TOKEN,
        socketMode: true,
      }
    : {
        token: env.SLACK_BOT_TOKEN,
        signingSecret: env.SLACK_SIGNING_SECRET,
        port: env.PORT,
      }
);

registerCommandHandlers(app);
registerActionHandlers(app);
registerViewHandlers(app);
registerEventHandlers(app);

async function startServer() {
  if (isSocketMode) {
    await app.start();
  } else {
    await app.start(env.PORT);
  }
  console.log(
    `🐣 Pollito Slack Bot is running in ${env.NODE_ENV} mode (${
      isSocketMode ? 'Socket Mode' : `HTTP port ${env.PORT}`
    })`
  );
}

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('Fatal error starting Pollito:', err);
    process.exit(1);
  });
}
