import type { App } from '@slack/bolt';
import { prisma } from '../../db/prisma.js';
import { ENV_MANAGED_TOKEN } from '../../utils/crypto.js';
import { buildAppHomeView } from '../ui/views/appHome.js';

export function registerEventHandlers(app: App) {
  // App Home Opened Event
  app.event('app_home_opened', async ({ event, client, body }) => {
    try {
      const workspaceId = body.team_id ?? '';

      const [polls, totalActive, totalQuorumsReached, totalClosed] = await Promise.all([
        prisma.poll.findMany({
          where: { workspaceId },
          include: {
            options: { orderBy: { index: 'asc' } },
            participations: { select: { voterId: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        prisma.poll.count({ where: { workspaceId, status: 'ACTIVE' } }),
        prisma.poll.count({ where: { workspaceId, status: 'QUORUM_REACHED' } }),
        prisma.poll.count({
          where: {
            workspaceId,
            status: { in: ['CLOSED', 'TIME_EXPIRED', 'QUORUM_REACHED'] },
          },
        }),
      ]);

      const eligiblePolls = polls.filter((p) => p.eligibleVoterCount > 0);
      const avgParticipationPct =
        eligiblePolls.length > 0
          ? Math.round(
              eligiblePolls.reduce(
                (acc, p) =>
                  acc +
                  Math.min(100, (p.participations.length / p.eligibleVoterCount) * 100),
                0
              ) / eligiblePolls.length
            )
          : 0;

      const homeView = buildAppHomeView(polls.slice(0, 10), {
        totalActive,
        totalQuorumsReached,
        totalClosed,
        avgParticipationPct,
      });

      await client.views.publish({
        user_id: event.user,
        view: homeView,
      });
    } catch (error) {
      console.error('Failed to publish App Home view:', error);
    }
  });

  // App Uninstalled Event (purge data per privacy SLA)
  app.event('app_uninstalled', async ({ body }) => {
    try {
      const workspaceId = body.team_id;
      if (!workspaceId) return;

      console.log(`Workspace ${workspaceId} uninstalled Pollito. Purging data per SLA.`);
      await prisma.workspace.deleteMany({
        where: { id: workspaceId },
      });
    } catch (error) {
      console.error('Failed to handle app_uninstalled event:', error);
    }
  });

  // Tokens Revoked Event (deactivate workspace and clear stored bot token)
  app.event('tokens_revoked', async ({ body }) => {
    try {
      const workspaceId = body.team_id;
      if (!workspaceId) return;

      await prisma.workspace.updateMany({
        where: { id: workspaceId },
        data: {
          isActive: false,
          botToken: ENV_MANAGED_TOKEN,
        },
      });
    } catch (error) {
      console.error('Failed to handle tokens_revoked event:', error);
    }
  });
}
