import type { App, BlockAction } from '@slack/bolt';
import { PollService } from '../../services/pollService.js';
import { UpdateQueue } from '../../services/updateQueue.js';
import { buildCreatePollModalView } from '../ui/views/createPollModal.js';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';

export function registerActionHandlers(app: App) {
  // Handle option vote buttons (matches vote_option_*)
  app.action(/^vote_option_/, async ({ action, ack, body, client }) => {
    await ack();

    const blockAction = body as BlockAction;
    const buttonValue = (action as { value?: string }).value;
    if (!buttonValue) return;

    try {
      const { pollId, optionId } = JSON.parse(buttonValue) as {
        pollId: string;
        optionId: string;
      };

      const voterId = blockAction.user.id;
      const channelId = blockAction.channel?.id;
      const messageTs = blockAction.message?.ts;

      if (!channelId || !messageTs) return;

      // Fetch workspace settings or fallback to env salt
      const workspace = await prisma.workspace.findUnique({
        where: { id: blockAction.team?.id ?? '' },
        include: { settings: true },
      });

      const workspaceSalt = workspace?.settings?.anonymousSalt ?? env.APP_SECRET_SALT;

      const result = await PollService.castVote({
        pollId,
        voterId,
        optionId,
        workspaceSalt,
      });

      // Schedule debounced card update
      UpdateQueue.scheduleUpdate(pollId, channelId, messageTs, client);

      // Ephemeral confirmation
      const noticeText = result.poll.isAnonymous
        ? '🔒 Your anonymous vote has been recorded with double-urn encryption.'
        : '✅ Your vote has been recorded!';

      await client.chat.postEphemeral({
        channel: channelId,
        user: voterId,
        text: noticeText,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An error occurred while voting.';

      if (blockAction.channel?.id) {
        await client.chat.postEphemeral({
          channel: blockAction.channel.id,
          user: blockAction.user.id,
          text: `⚠️ ${errorMessage}`,
        });
      }
    }
  });

  // Handle "Launch New Poll" from App Home
  app.action('app_home_launch_poll_click', async ({ ack, body, client }) => {
    await ack();
    const blockAction = body as BlockAction;

    await client.views.open({
      trigger_id: blockAction.trigger_id,
      view: buildCreatePollModalView(''),
    });
  });

  // Handle documentation button click
  app.action('app_home_docs_click', async ({ ack }) => {
    await ack();
  });
}
