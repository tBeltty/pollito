import pkg from '@slack/bolt';
const { App } = pkg;
import { env } from './config/env.js';
import { registerCommandHandlers } from './slack/handlers/commands.js';
import { registerActionHandlers } from './slack/handlers/actions.js';
import { registerViewHandlers } from './slack/handlers/views.js';
import { registerEventHandlers } from './slack/handlers/events.js';

const isSocketMode = env.SLACK_SOCKET_MODE === true && Boolean(env.SLACK_APP_TOKEN);

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
  {
    path: '/slack/oauth_redirect',
    method: ['GET'],
    handler: (_req: any, res: any) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pollito Installed!</title>
  <style>
    body {
      background: #0F172A;
      color: #F8FAFC;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      box-sizing: border-box;
      text-align: center;
    }
    .card {
      background: #1E293B;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 40px 32px;
      max-width: 440px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .mascot {
      width: 80px;
      height: 80px;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      margin: 0 0 12px;
      color: #F8FAFC;
    }
    p {
      color: #94A3B8;
      font-size: 15px;
      line-height: 1.6;
      margin: 0 0 28px;
    }
    .btn {
      display: inline-block;
      background: #F59E0B;
      color: #0F172A;
      font-weight: 600;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 8px;
      font-size: 15px;
      transition: background 0.15s ease;
    }
    .btn:hover {
      background: #D97706;
    }
  </style>
</head>
<body>
  <div class="card">
    <img src="/assets/plates/pollito-nav-logo.png?v=4" alt="Pollito" class="mascot">
    <h1>Pollito Installed!</h1>
    <p>Pollito is now ready in your Slack workspace. Head back to Slack and run <strong>/pollito</strong> in any channel to create your first poll.</p>
    <a href="slack://open" class="btn">Open Slack</a>
  </div>
</body>
</html>`);
    },
  },
];

export const app = new App(
  isSocketMode
    ? {
        token: env.SLACK_BOT_TOKEN,
        appToken: env.SLACK_APP_TOKEN,
        socketMode: true,
        port: env.PORT,
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
    `Pollito Slack Bot is running in ${env.NODE_ENV} mode (${
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
