import type { App } from '@slack/bolt';
import { prisma } from '../../db/prisma.js';
import { PollService } from '../../services/pollService.js';
import { ENV_MANAGED_TOKEN } from '../../utils/crypto.js';
import { buildAppHomeView } from '../ui/views/appHome.js';
import {
  recordHuddleMessageEvent,
  isHuddleMessage,
  isHuddleEnded,
  notifyMainChannelOnHuddleEnd,
} from '../utils/huddleDiscovery.js';

export async function publishHomeTab(
  client: any,
  userId: string,
  workspaceId: string
): Promise<void> {
  const [settings, viewer, polls] = await Promise.all([
    PollService.getWorkspaceSettings(workspaceId),
    PollService.getReportViewer(client, userId, workspaceId),
    prisma.poll.findMany({
      where: { workspaceId },
      include: {
        options: { orderBy: { index: 'asc' } },
        participations: { select: { voterId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
  ]);

  const stats = await PollService.getPollAnalyticsStats(workspaceId, viewer, 30);

  const homeView = buildAppHomeView(polls.slice(0, 10), {
    totalActive: stats.totalActive,
    totalQuorumsReached: stats.totalQuorumsReached,
    totalClosed: stats.totalClosed,
    avgParticipationPct: stats.avgParticipationPct,
    currentUserId: userId,
    isManager: viewer.isManager,
    maxNudgeChannelMembers: settings.maxNudgeChannelMembers,
    allowVoterChoiceNudges: settings.allowVoterChoiceNudges,
  });

  await client.views.publish({
    user_id: userId,
    view: homeView,
  });
}

export function registerEventHandlers(app: App) {
  // Track Huddle thread root timestamps and detect Huddle closure from message events
  if (typeof (app as any).event === 'function') {
    app.event('message', async ({ event, client }: any) => {
      try {
        recordHuddleMessageEvent(event);

        if (
          isHuddleMessage(event) &&
          isHuddleEnded(event) &&
          (event as any).channel
        ) {
          const channelId = (event as any).channel;
          const pendingPolls =
            await PollService.getActiveHuddlePollsPendingReminder(channelId);

          for (const poll of pendingPolls) {
            await notifyMainChannelOnHuddleEnd(client, poll);
          }
        }
      } catch {
        // ignore non-critical huddle cache errors
      }
    });
  }

  // App Home Opened Event
  app.event('app_home_opened', async ({ event, client, body }) => {
    try {
      const workspaceId = body.team_id ?? '';
      await publishHomeTab(client, event.user, workspaceId);
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
