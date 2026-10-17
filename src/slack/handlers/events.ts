import type { App } from '@slack/bolt';
import { prisma } from '../../db/prisma.js';
import { buildAppHomeView } from '../ui/views/appHome.js';

export function registerEventHandlers(app: App) {
  // App Home Opened Event
  app.event('app_home_opened', async ({ event, client, body }) => {
    try {
      const workspaceId = body.team_id ?? '';

      const polls = await prisma.poll.findMany({
        where: { workspaceId },
        include: {
          options: { orderBy: { index: 'asc' } },
          participations: { select: { voterId: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      const homeView = buildAppHomeView(polls);

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
}
