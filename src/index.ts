import crypto from 'node:crypto';
import pkg from '@slack/bolt';
const { App } = pkg;
import { env } from './config/env.js';
import { initSqlitePragmas, prisma } from './db/prisma.js';
import { encryptToken, ENV_MANAGED_TOKEN } from './utils/crypto.js';
import { PollService } from './services/pollService.js';
import { UpdateQueue } from './services/updateQueue.js';
import { registerCommandHandlers } from './slack/handlers/commands.js';
import { registerActionHandlers } from './slack/handlers/actions.js';
import { registerViewHandlers } from './slack/handlers/views.js';
import { registerEventHandlers } from './slack/handlers/events.js';
import { PollTimerWorker } from './workers/pollTimerWorker.js';

export const BOT_SCOPES = [
  'commands',
  'chat:write',
  'chat:write.public',
  'channels:join',
  'channels:read',
  'channels:history',
  'groups:read',
  'groups:history',
  'im:read',
  'im:history',
  'im:write',
  'mpim:read',
  'mpim:history',
  'users:read',
].join(',');

const isSocketMode = env.SLACK_SOCKET_MODE === true && Boolean(env.SLACK_APP_TOKEN);

function signOAuthState(nonce: string): string {
  const sig = crypto
    .createHmac('sha256', env.SLACK_STATE_SECRET || env.APP_SECRET_SALT)
    .update(nonce)
    .digest('hex');
  return `${nonce}.${sig}`;
}

function verifyOAuthState(stateParam: string, cookieHeader?: string): boolean {
  const parts = stateParam.split('.');
  if (parts.length !== 2) return false;
  const [nonce, sig] = parts;
  if (!nonce || !sig) return false;

  const expectedSig = crypto
    .createHmac('sha256', env.SLACK_STATE_SECRET || env.APP_SECRET_SALT)
    .update(nonce)
    .digest('hex');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return false;
  }

  if (cookieHeader) {
    const match = cookieHeader
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('pollito_oauth_state='));
    if (match) {
      const cookieVal = decodeURIComponent(
        match.slice('pollito_oauth_state='.length)
      );
      if (cookieVal !== stateParam) {
        return false;
      }
    }
  }

  return true;
}

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
    path: '/slack/install',
    method: ['GET'],
    handler: (_req: any, res: any) => {
      const state = crypto.randomBytes(16).toString('hex');
      const signedState = signOAuthState(state);

      if (env.SLACK_CLIENT_ID) {
        const authorizeUrl = `https://slack.com/oauth/v2/authorize?client_id=${encodeURIComponent(
          env.SLACK_CLIENT_ID
        )}&scope=${encodeURIComponent(BOT_SCOPES)}&state=${encodeURIComponent(
          signedState
        )}`;
        res.writeHead(302, {
          Location: authorizeUrl,
          'Set-Cookie': `pollito_oauth_state=${signedState}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
        });
        res.end();
        return;
      }

      res.writeHead(302, { Location: '/' });
      res.end();
    },
  },
  {
    path: '/slack/oauth_redirect',
    method: ['GET'],
    handler: async (_req: any, res: any) => {
      try {
        const reqUrl = new URL(
          _req.url || '/slack/oauth_redirect',
          'http://localhost'
        );
        const code = reqUrl.searchParams.get('code');
        const state = reqUrl.searchParams.get('state');
        const error = reqUrl.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Installation Cancelled</title></head>
<body><h1>Installation Cancelled</h1><p>Slack authorization was cancelled.</p></body>
</html>`);
          return;
        }

        if (code && env.SLACK_CLIENT_ID && env.SLACK_CLIENT_SECRET) {
          if (state && !verifyOAuthState(state, _req.headers?.cookie)) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Invalid OAuth State</title></head>
<body><h1>Invalid OAuth State</h1><p>State verification failed. Please retry installing Pollito.</p></body>
</html>`);
            return;
          }

          const oauthRes = await app.client.oauth.v2.access({
            client_id: env.SLACK_CLIENT_ID,
            client_secret: env.SLACK_CLIENT_SECRET,
            code,
          });

          if (oauthRes.ok && oauthRes.access_token && oauthRes.team?.id) {
            const encryptedBotToken = encryptToken(
              oauthRes.access_token,
              env.APP_SECRET_SALT
            );
            await prisma.workspace.upsert({
              where: { id: oauthRes.team.id },
              update: {
                teamName: oauthRes.team.name || 'Workspace',
                botToken: encryptedBotToken,
                isActive: true,
              },
              create: {
                id: oauthRes.team.id,
                teamName: oauthRes.team.name || 'Workspace',
                botToken: encryptedBotToken,
                isActive: true,
                settings: {
                  create: {
                    anonymousSalt: crypto.randomBytes(32).toString('hex'),
                  },
                },
              },
            });
          }
        }

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
      } catch (err) {
        console.error('OAuth redirect error:', err);
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>OAuth Installation Failed</h1>');
      }
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

const processedEvents = new Map<string, number>();
const EVENT_DEDUP_TTL_MS = 5 * 60 * 1000;

app.use(async ({ context, body, next }) => {
  const now = Date.now();
  for (const [id, timestamp] of processedEvents.entries()) {
    if (now - timestamp > EVENT_DEDUP_TTL_MS) {
      processedEvents.delete(id);
    }
  }

  const payload = body as Record<string, any> | undefined;
  if (
    payload?.type === 'event_callback' &&
    typeof payload.event_id === 'string'
  ) {
    if (
      processedEvents.has(payload.event_id) ||
      (context.retryNum &&
        context.retryNum > 0 &&
        processedEvents.has(payload.event_id))
    ) {
      return;
    }
    processedEvents.set(payload.event_id, now);
  }

  const teamId: string | undefined = payload?.team_id ?? payload?.team?.id;
  if (teamId) {
    try {
      context.botToken = await PollService.resolveWorkspaceBotToken(teamId);
    } catch {
      // Fallback to default token
    }
  }

  await next();
});

app.error(async (error) => {
  console.error('[Pollito Bolt Error]:', error);
});

registerCommandHandlers(app);
registerActionHandlers(app);
registerViewHandlers(app);
registerEventHandlers(app);

export const pollTimerWorker = new PollTimerWorker(app, 30000);

async function startServer() {
  await initSqlitePragmas();

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

export async function gracefulShutdown() {
  pollTimerWorker.stop();
  await UpdateQueue.flushAll();
  try {
    await app.stop();
  } catch {
    // Ignore if server was not started
  }
  await prisma.$disconnect();
}

process.on('SIGTERM', () => {
  void gracefulShutdown();
});
process.on('SIGINT', () => {
  void gracefulShutdown();
});

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('Fatal error starting Pollito:', err);
    process.exit(1);
  });
}

