import type { App } from '@slack/bolt';
import { buildCreatePollModalView } from '../ui/views/createPollModal.js';
import { buildAnalyticsModalView } from '../ui/views/analyticsModal.js';
import { PollService } from '../../services/pollService.js';
import { UpdateQueue } from '../../services/updateQueue.js';
import { buildPollMessageBlocks } from '../ui/views/pollMessage.js';
import { prisma } from '../../db/prisma.js';
import {
  formatPollClosureSummary,
  getEligibleChannelMembers,
} from '../utils/channelMembers.js';
import {
  findActiveHuddleThread,
  parseHuddleThreadInput,
} from '../utils/huddleDiscovery.js';

export function registerCommandHandlers(app: App) {
  app.command('/pollito', async ({ command, ack, client }) => {
    await ack();

    try {
      const text = command.text.trim();
      const lowerText = text.toLowerCase();

      // 1. If text is empty, open creation modal
      if (!text) {
        await client.views.open({
          trigger_id: command.trigger_id,
          view: buildCreatePollModalView(command.channel_id),
        });
        return;
      }

      // 2. Help command
      if (lowerText === 'help') {
        await client.chat.postEphemeral({
          channel: command.channel_id,
          user: command.user_id,
          text: '*Pollito Quick Help*\n\n• `/pollito` — Opens modal builder.\n• `/pollito "Question" "Option 1" "Option 2"` — Creates an instant poll.\n• `/pollito huddle` — Opens modal to launch a poll inside the active Huddle thread.\n• `/pollito huddle "Question" "Option 1" "Option 2"` — Launches an instant poll inside the active Huddle thread.\n• `/pollito close [poll-id]` — Closes an active poll created by you.\n• `/pollito nudge [poll-id]` — Sends private reminders to non-voters.\n• `/pollito report` — Opens the analytics report for your polls or workspace.\n• Visit App Home to view recent results and templates.',
        });
        return;
      }

      // 3. Huddle command: /pollito huddle or /pollito huddle "Question" "Opt 1" "Opt 2"
      if (lowerText === 'huddle' || lowerText.startsWith('huddle ')) {
        try {
          await PollService.assertCanCreatePollInChannel(command.team_id, command.channel_id);
        } catch (err: any) {
          await client.chat.postEphemeral({
            channel: command.channel_id,
            user: command.user_id,
            text: err?.message || 'An active poll is already running in this channel.',
          });
          return;
        }

        const huddleRest = text.slice(6).trim();
        const leadingPart = huddleRest.split('"')[0]?.trim() || '';
        const firstToken = leadingPart.split(/\s+/)[0] || '';
        const parsedLinkTs = firstToken
          ? parseHuddleThreadInput(firstToken)
          : null;

        const explicitThreadTs =
          (command as any).thread_ts || (command as any).threadTs || null;
        const huddleThreadTs =
          explicitThreadTs ||
          parsedLinkTs ||
          (await findActiveHuddleThread(client, command.channel_id));

        const huddleMatches = [...huddleRest.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

        if (huddleMatches.length >= 3) {
          if (!huddleThreadTs) {
            await client.chat.postEphemeral({
              channel: command.channel_id,
              user: command.user_id,
              text: 'No active Huddle thread was found in this channel. Start a Huddle first, or run `/pollito huddle` to open the Huddle poll modal.',
            });
            return;
          }

          const question = huddleMatches[0];
          const options = huddleMatches.slice(1, 7);

          try {
            await client.conversations.join({ channel: command.channel_id });
          } catch {
            // Safe to ignore
          }

          const members = await getEligibleChannelMembers(client, command.channel_id);
          const memberCount = members.length > 0 ? members.length : 10;

          let placeholder;
          try {
            placeholder = await client.chat.postMessage({
              channel: command.channel_id,
              thread_ts: huddleThreadTs,
              text: `Creating poll: ${question}...`,
            });
          } catch (error: any) {
            if (error?.data?.error === 'not_in_channel') {
              await client.chat.postEphemeral({
                channel: command.channel_id,
                user: command.user_id,
                text: 'Pollito needs to be invited to this channel first. Type `/invite @Pollito` and run `/pollito huddle` again.',
              });
              return;
            }
            throw error;
          }

          if (!placeholder?.ts) return;

          const settings = await PollService.getWorkspaceSettings(command.team_id);

          const poll = await PollService.createPoll({
            workspaceId: command.team_id,
            channelId: command.channel_id,
            messageTs: placeholder.ts,
            threadTs: huddleThreadTs,
            creatorId: command.user_id,
            question,
            options,
            isAnonymous: settings.defaultAnonymous,
            quorumType:
              (settings.defaultQuorumType as 'PERCENTAGE' | 'NONE') || 'PERCENTAGE',
            quorumTarget: settings.defaultQuorumPct,
            eligibleVoterCount: memberCount,
            forwardToChannelOnHuddleEnd: true,
          });

          const blocks = buildPollMessageBlocks(
            {
              ...poll,
              participations: [],
            },
            {
              maxNudgeChannelMembers: settings.maxNudgeChannelMembers,
              allowVoterChoiceNudges: settings.allowVoterChoiceNudges,
            }
          );

          await client.chat.update({
            channel: command.channel_id,
            ts: placeholder.ts,
            text: `Poll: ${question}`,
            blocks,
          });
          return;
        }

        await client.views.open({
          trigger_id: command.trigger_id,
          view: buildCreatePollModalView({
            channelId: command.channel_id,
            threadTs: huddleThreadTs,
            huddleMode: true,
          }),
        });
        return;
      }

      // 4. Report command: /pollito report
      if (lowerText === 'report' || lowerText.startsWith('report ')) {
        const viewer = await PollService.getReportViewer(
          client,
          command.user_id,
          command.team_id
        );
        const stats = await PollService.getPollAnalyticsStats(command.team_id, viewer, 30);

        if (command.trigger_id && client.views?.open) {
          try {
            await client.views.open({
              trigger_id: command.trigger_id,
              view: buildAnalyticsModalView(stats, 30),
            });
          } catch (modalErr) {
            console.error('Failed to open analytics modal from /pollito report:', modalErr);
          }
        }

        await client.chat.postEphemeral({
          channel: command.channel_id,
          user: command.user_id,
          text: `*Pollito Analytics (${stats.scope === 'workspace' ? 'Workspace' : 'Your Polls'})* — *${stats.totalPolls}* polls (*${stats.totalActive}* active, *${stats.totalQuorumsReached}* reached quorum, *${stats.avgParticipationPct}%* avg participation).`,
        });
        return;
      }

      // 5. Close command: /pollito close [poll-id]
      if (lowerText.startsWith('close')) {
        const argId = text.slice(5).trim();
        const whereClause: any = {
          channelId: command.channel_id,
          creatorId: command.user_id,
          status: 'ACTIVE',
        };
        if (argId) {
          whereClause.OR = [
            { id: argId },
            { id: { endsWith: argId } },
          ];
        }

        const poll = await prisma.poll.findFirst({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
        });

        if (!poll) {
          await client.chat.postEphemeral({
            channel: command.channel_id,
            user: command.user_id,
            text: 'No active poll found in this channel that you created.',
          });
          return;
        }

        const closedPoll = await PollService.closePoll(poll.id, command.user_id, 'CLOSED');
        await UpdateQueue.flushNow(closedPoll.id, closedPoll.channelId, closedPoll.messageTs, client);
        await client.chat.postMessage({
          channel: closedPoll.channelId,
          thread_ts: closedPoll.threadTs || closedPoll.messageTs,
          text: formatPollClosureSummary(closedPoll, 'CLOSED'),
        });

        await client.chat.postEphemeral({
          channel: command.channel_id,
          user: command.user_id,
          text: `Poll closed successfully: *${closedPoll.question}*`,
        });
        return;
      }

      // 6. Nudge command: /pollito nudge [poll-id]
      if (lowerText.startsWith('nudge')) {
        const argId = text.slice(5).trim();
        const whereClause: any = {
          channelId: command.channel_id,
          creatorId: command.user_id,
          status: 'ACTIVE',
        };
        if (argId) {
          whereClause.OR = [
            { id: argId },
            { id: { endsWith: argId } },
          ];
        }

        const poll = await prisma.poll.findFirst({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
        });

        if (!poll) {
          await client.chat.postEphemeral({
            channel: command.channel_id,
            user: command.user_id,
            text: 'No active poll found in this channel that you created.',
          });
          return;
        }

        const settings = await PollService.getWorkspaceSettings(command.team_id);
        if (!settings.allowVoterChoiceNudges) {
          await client.chat.postEphemeral({
            channel: command.channel_id,
            user: command.user_id,
            text: 'Smart Nudges are disabled in this workspace.',
          });
          return;
        }

        const members = await getEligibleChannelMembers(client, poll.channelId);
        const channelMemberCount =
          members.length > 0 ? members.length : poll.eligibleVoterCount;
        if (channelMemberCount > settings.maxNudgeChannelMembers) {
          await client.chat.postEphemeral({
            channel: command.channel_id,
            user: command.user_id,
            text: `Smart Nudges are disabled for channels with more than ${settings.maxNudgeChannelMembers} members.`,
          });
          return;
        }

        const recentNudge = await prisma.nudgeLog.findFirst({
          where: {
            pollId: poll.id,
            sentAt: { gte: new Date(Date.now() - 4 * 60 * 60 * 1000) },
          },
        });

        if (recentNudge) {
          await client.chat.postEphemeral({
            channel: command.channel_id,
            user: command.user_id,
            text: 'A reminder was already sent within the last 4 hours.',
          });
          return;
        }

        const nonVoters = await PollService.getNonVoters(poll.id, members);
        const recipients = nonVoters.slice(0, settings.maxNudgeChannelMembers);

        let sentCount = 0;
        for (const recipientId of recipients) {
          try {
            await client.chat.postMessage({
              channel: recipientId,
              text: `👋 Friendly reminder from <@${poll.creatorId}>: Your vote is still needed on *${poll.question}* in <#${poll.channelId}>.`,
            });
            await prisma.nudgeLog.create({
              data: {
                pollId: poll.id,
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

        await client.chat.postEphemeral({
          channel: command.channel_id,
          user: command.user_id,
          text: confirmationText,
        });
        return;
      }

      // 7. Quick poll syntax: /pollito "Question" "Option 1" "Option 2"
      const matches = [...text.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

      if (matches.length >= 3) {
        try {
          await PollService.assertCanCreatePollInChannel(command.team_id, command.channel_id);
        } catch (err: any) {
          await client.chat.postEphemeral({
            channel: command.channel_id,
            user: command.user_id,
            text: err?.message || 'An active poll is already running in this channel.',
          });
          return;
        }

        const question = matches[0];
        const options = matches.slice(1, 7); // Up to 6 options

        // Auto-join if public channel
        try {
          await client.conversations.join({ channel: command.channel_id });
        } catch {
          // Safe to ignore if already in channel or private channel
        }

        // Fetch channel members for quorum calculation excluding bot
        const members = await getEligibleChannelMembers(client, command.channel_id);
        const memberCount = members.length > 0 ? members.length : 10;

        // Initial placeholder message to reserve ts
        let placeholder;
        try {
          placeholder = await client.chat.postMessage({
            channel: command.channel_id,
            text: `Creating poll: ${question}...`,
          });
        } catch (error: any) {
          if (error?.data?.error === 'not_in_channel') {
            await client.chat.postEphemeral({
              channel: command.channel_id,
              user: command.user_id,
              text: 'Pollito needs to be invited to this channel first. Type `/invite @Pollito` and run `/pollito` again.',
            });
            return;
          }
          throw error;
        }

        if (!placeholder?.ts) return;

        const settings = await PollService.getWorkspaceSettings(command.team_id);

        const poll = await PollService.createPoll({
          workspaceId: command.team_id,
          channelId: command.channel_id,
          messageTs: placeholder.ts,
          creatorId: command.user_id,
          question,
          options,
          isAnonymous: false,
          quorumType: 'PERCENTAGE',
          quorumTarget: 70,
          eligibleVoterCount: memberCount,
        });

        const blocks = buildPollMessageBlocks(
          {
            ...poll,
            participations: [],
          },
          {
            maxNudgeChannelMembers: settings.maxNudgeChannelMembers,
            allowVoterChoiceNudges: settings.allowVoterChoiceNudges,
          }
        );

        await client.chat.update({
          channel: command.channel_id,
          ts: placeholder.ts,
          text: `Poll: ${question}`,
          blocks,
        });
        return;
      }

      // Fallback for unrecognized syntax: open modal
      await client.views.open({
        trigger_id: command.trigger_id,
        view: buildCreatePollModalView(command.channel_id),
      });
    } catch (error) {
      console.error('Error handling /pollito command:', error);
      const msg = error instanceof Error ? error.message : 'An error occurred processing the command.';
      try {
        await client.chat.postEphemeral({
          channel: command.channel_id,
          user: command.user_id,
          text: msg,
        });
      } catch {
        // ignore
      }
    }
  });
}
