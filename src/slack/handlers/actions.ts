import type { App, BlockAction } from '@slack/bolt';
import { PollService } from '../../services/pollService.js';
import { UpdateQueue } from '../../services/updateQueue.js';
import {
  buildCreatePollModalView,
  type CreatePollModalPreset,
} from '../ui/views/createPollModal.js';
import {
  buildAppHomeView,
  buildCsvExportModalView,
  buildPollsCsvReport,
} from '../ui/views/appHome.js';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import {
  formatPollClosureSummary,
  getEligibleChannelMembers,
} from '../utils/channelMembers.js';

const APP_HOME_TEMPLATES: Record<string, CreatePollModalPreset> = {
  standup: {
    question: 'Do we have any blockers for today’s standup?',
    options: ['All clear — on track', 'Minor blocker — need sync', 'Blocked — need review'],
    isAnonymous: false,
    allowMultipleVotes: false,
    quorumTarget: 80,
    duration: '15m',
  },
  retro: {
    question: 'Which sprint retrospective slot works best?',
    options: ['Thursday 14:00 UTC', 'Thursday 16:00 UTC', 'Friday 14:00 UTC', 'Friday 16:00 UTC'],
    isAnonymous: false,
    allowMultipleVotes: true,
    quorumTarget: 75,
    duration: '24h',
  },
  rfc: {
    question: 'How should we proceed with the proposed Architecture RFC?',
    options: [
      'Approve as proposed',
      'Approve with minor revisions',
      'Needs deeper architecture review',
      'Abstain',
    ],
    isAnonymous: true,
    allowMultipleVotes: false,
    quorumTarget: 70,
    duration: '72h',
  },
  lunch: {
    question: 'Where should the team go for lunch this Friday?',
    options: ['Tacos', 'Ramen', 'Wood-fired Pizza', 'Mediterranean'],
    isAnonymous: true,
    allowMultipleVotes: true,
    quorumTarget: 50,
    duration: '4h',
  },
};

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

      if (result.quorumReached) {
        await UpdateQueue.flushNow(pollId, channelId, messageTs, client);
        await client.chat.postMessage({
          channel: channelId,
          thread_ts: messageTs,
          text: formatPollClosureSummary(result.poll, 'QUORUM_REACHED'),
        });
      } else {
        UpdateQueue.scheduleUpdate(pollId, channelId, messageTs, client);
      }

      // Ephemeral confirmation
      const noticeText = result.poll.isAnonymous
        ? 'Your anonymous vote has been recorded.'
        : 'Your vote has been recorded.';

      await client.chat.postEphemeral({
        channel: channelId,
        user: voterId,
        text: noticeText,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An error occurred while voting.';

      if (blockAction.channel?.id) {
        try {
          await client.chat.postEphemeral({
            channel: blockAction.channel.id,
            user: blockAction.user.id,
            text: errorMessage,
          });
        } catch {
          // Ignore ephemeral failures
        }
      }
    }
  });

  // Handle manual poll closure from UI button (matches poll_close_click)
  app.action(/^poll_close_click/, async ({ action, ack, body, client }) => {
    await ack();

    const blockAction = body as BlockAction;
    const rawVal = (action as { value?: string }).value;
    if (!rawVal) return;

    let pollId = rawVal;
    try {
      const parsed = JSON.parse(rawVal);
      if (typeof parsed === 'object' && parsed !== null && parsed.pollId) {
        pollId = parsed.pollId;
      }
    } catch {
      // plain string ID
    }

    try {
      const closedPoll = await PollService.closePoll(pollId, blockAction.user.id, 'CLOSED');
      await UpdateQueue.flushNow(closedPoll.id, closedPoll.channelId, closedPoll.messageTs, client);
      await client.chat.postMessage({
        channel: closedPoll.channelId,
        thread_ts: closedPoll.messageTs,
        text: formatPollClosureSummary(closedPoll, 'CLOSED'),
      });

      if ((blockAction as any).view?.type === 'home') {
        try {
          const workspaceId = blockAction.team?.id ?? '';
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
            user_id: blockAction.user.id,
            view: homeView,
          });
        } catch (publishErr) {
          console.error('Failed to update App Home after poll closure:', publishErr);
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An error occurred while closing the poll.';

      if (blockAction.channel?.id) {
        try {
          await client.chat.postEphemeral({
            channel: blockAction.channel.id,
            user: blockAction.user.id,
            text: errorMessage,
          });
        } catch {
          // ignore
        }
      } else {
        try {
          await client.chat.postMessage({
            channel: blockAction.user.id,
            text: errorMessage,
          });
        } catch {
          // ignore
        }
      }
    }
  });

  // Handle Smart Nudge button click (matches poll_nudge_click)
  app.action(/^poll_nudge_click/, async ({ action, ack, body, client }) => {
    await ack();

    const blockAction = body as BlockAction;
    const rawVal = (action as { value?: string }).value;
    if (!rawVal) return;

    let pollId = rawVal;
    try {
      const parsed = JSON.parse(rawVal);
      if (typeof parsed === 'object' && parsed !== null && parsed.pollId) {
        pollId = parsed.pollId;
      }
    } catch {
      // plain string ID
    }

    try {
      const poll = await prisma.poll.findUnique({
        where: { id: pollId },
      });

      if (!poll) {
        throw new Error('Poll not found');
      }

      if (poll.status !== 'ACTIVE') {
        throw new Error('This poll is closed and no longer accepting votes');
      }

      if (poll.creatorId !== blockAction.user.id) {
        throw new Error('Only the poll creator can send nudges for this poll');
      }

      const recentNudge = await prisma.nudgeLog.findFirst({
        where: {
          pollId,
          sentAt: { gte: new Date(Date.now() - 4 * 60 * 60 * 1000) },
        },
      });

      if (recentNudge) {
        throw new Error('A reminder was already sent within the last 4 hours');
      }

      const members = await getEligibleChannelMembers(client, poll.channelId);
      const nonVoters = await PollService.getNonVoters(pollId, members);
      const recipients = nonVoters.slice(0, 50);

      let sentCount = 0;
      for (const recipientId of recipients) {
        try {
          await client.chat.postMessage({
            channel: recipientId,
            text: `👋 Friendly reminder from <@${poll.creatorId}>: Your vote is still needed on *${poll.question}* in <#${poll.channelId}>.`,
          });
          await prisma.nudgeLog.create({
            data: {
              pollId,
              recipientId,
            },
          });
          sentCount++;
        } catch (err) {
          console.error(`Failed to nudge user ${recipientId}:`, err);
        }
      }

      const confirmationText =
        sentCount === 0
          ? 'No pending votes found. Everyone has already cast their ballot!'
          : `📬 Sent private reminders to ${sentCount} ${sentCount === 1 ? 'teammate' : 'teammates'}.`;

      if (blockAction.channel?.id) {
        try {
          await client.chat.postEphemeral({
            channel: blockAction.channel.id,
            user: blockAction.user.id,
            text: confirmationText,
          });
        } catch {
          // ignore
        }
      } else {
        try {
          await client.chat.postMessage({
            channel: blockAction.user.id,
            text: confirmationText,
          });
        } catch {
          // ignore
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An error occurred while sending reminders.';

      if (blockAction.channel?.id) {
        try {
          await client.chat.postEphemeral({
            channel: blockAction.channel.id,
            user: blockAction.user.id,
            text: errorMessage,
          });
        } catch {
          // ignore
        }
      } else {
        try {
          await client.chat.postMessage({
            channel: blockAction.user.id,
            text: errorMessage,
          });
        } catch {
          // ignore
        }
      }
    }
  });

  // Handle "Launch New Poll" from App Home
  app.action('app_home_launch_poll_click', async ({ ack, body, client }) => {
    await ack();
    const blockAction = body as BlockAction;

    try {
      await client.views.open({
        trigger_id: blockAction.trigger_id,
        view: buildCreatePollModalView(''),
      });
    } catch (error) {
      console.error('Failed to open create poll modal from App Home:', error);
    }
  });

  // Handle Quick Template buttons from App Home (matches app_home_template_*)
  app.action(/^app_home_template_/, async ({ action, ack, body, client }) => {
    await ack();
    const blockAction = body as BlockAction;
    const actionObj = action as { action_id?: string; value?: string };
    const templateKey =
      actionObj.value ??
      actionObj.action_id?.replace(/^app_home_template_/, '') ??
      'standup';
    const preset = APP_HOME_TEMPLATES[templateKey] ?? APP_HOME_TEMPLATES.standup;

    try {
      await client.views.open({
        trigger_id: blockAction.trigger_id,
        view: buildCreatePollModalView(preset),
      });
    } catch (error) {
      console.error('Failed to open template modal from App Home:', error);
    }
  });

  // Handle "Export CSV" button from App Home
  app.action('app_home_export_csv_click', async ({ ack, body, client }) => {
    await ack();
    const blockAction = body as BlockAction;
    const workspaceId = blockAction.team?.id ?? '';

    try {
      const polls = await prisma.poll.findMany({
        where: { workspaceId },
        include: {
          options: { orderBy: { index: 'asc' } },
          participations: { select: { voterId: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      const csvContent = buildPollsCsvReport(polls);
      await client.views.open({
        trigger_id: blockAction.trigger_id,
        view: buildCsvExportModalView(csvContent),
      });
    } catch (error) {
      console.error('Failed to open CSV export modal from App Home:', error);
    }
  });

  // Handle documentation button click
  app.action('app_home_docs_click', async ({ ack }) => {
    await ack();
  });
}
