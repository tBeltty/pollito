import type { AllMiddlewareArgs, App, SlackCommandMiddlewareArgs } from '@slack/bolt';
import { buildCreatePollModalView } from '../ui/views/createPollModal.js';
import { buildAnalyticsModalView } from '../ui/views/analyticsModal.js';
import { PollService } from '../../services/pollService.js';
import { UpdateQueue } from '../../services/updateQueue.js';
import {
  buildPollCreatorControlsBlocks,
  buildPollMessageBlocks,
} from '../ui/views/pollMessage.js';
import { prisma } from '../../db/prisma.js';
import {
  formatPollClosureSummary,
  getEligibleChannelMembers,
} from '../utils/channelMembers.js';
import {
  findActiveHuddleThread,
  getMostRecentCachedActiveHuddle,
  parseHuddleThreadInput,
} from '../utils/huddleDiscovery.js';
import { getPollTranslator, getRequestTranslator } from '../utils/locale.js';
import { NUDGE_COOLDOWN_HOURS } from '../../config/limits.js';

/**
 * Slack autocompletes only top-level command names, so each subcommand is also registered as
 * `/pollito-<name>`. Typing `/pollito` then lists them all as clickable suggestions.
 */
const SUBCOMMAND_ALIASES = ['huddle', 'report', 'close', 'nudge'] as const;

const registeredShortcutApps = new WeakSet<object>();

export function registerShortcutHandlers(app: App) {
  if (!app || typeof (app as any).shortcut !== 'function') {
    return;
  }
  if (registeredShortcutApps.has(app)) {
    return;
  }
  registeredShortcutApps.add(app);

  // Message shortcut: invoked from any message "..." menu inside a thread or Huddle thread
  app.shortcut('create_poll_thread_shortcut', async ({ shortcut, ack, body, client }: any) => {
    await ack();
    try {
      const payload = shortcut || body;
      const channelId = String(payload?.channel?.id || '').trim();
      const message = payload?.message || {};
      const threadTs = String(message.thread_ts || message.ts || '').trim() || null;
      const userId = payload?.user?.id || body?.user?.id;
      const workspaceId = payload?.team?.id || body?.team?.id;
      const triggerId = payload?.trigger_id || body?.trigger_id;
      if (!triggerId) return;

      const translator = await getRequestTranslator(client, {
        userId,
        workspaceId,
      });

      await client.views.open({
        trigger_id: triggerId,
        view: buildCreatePollModalView({
          channelId,
          threadTs,
          huddleMode: true,
          translator,
        }),
      });
    } catch (error) {
      console.error('Failed to open thread poll modal from message shortcut:', error);
    }
  });

  // Global shortcut: "Create a Huddle poll" (surfaces in `/` menu inside threads and Huddles)
  app.shortcut('create_huddle_poll_shortcut', async ({ shortcut, ack, body, client }: any) => {
    await ack();
    try {
      const payload = shortcut || body;
      const userId = payload?.user?.id || body?.user?.id;
      const workspaceId = payload?.team?.id || body?.team?.id;
      const triggerId = payload?.trigger_id || body?.trigger_id;
      if (!triggerId) return;

      const translator = await getRequestTranslator(client, {
        userId,
        workspaceId,
      });

      let channelId = String(payload?.channel?.id || '').trim();
      let threadTs: string | null =
        String(payload?.message?.thread_ts || payload?.message?.ts || '').trim() || null;

      if (channelId && !threadTs) {
        const botToken = workspaceId
          ? await PollService.resolveWorkspaceBotToken(workspaceId)
          : undefined;
        threadTs = await findActiveHuddleThread(client, channelId, botToken);
      } else if (!channelId) {
        const cachedHuddle = getMostRecentCachedActiveHuddle();
        if (cachedHuddle) {
          channelId = cachedHuddle.channelId;
          threadTs = cachedHuddle.threadTs;
        }
      }

      await client.views.open({
        trigger_id: triggerId,
        view: buildCreatePollModalView({
          channelId,
          threadTs,
          huddleMode: true,
          translator,
        }),
      });
    } catch (error) {
      console.error('Failed to open Huddle poll modal from global shortcut:', error);
    }
  });

  // Global shortcut: "Create a poll" (surfaces in `/` menu inside threads and Huddles)
  app.shortcut('create_poll_shortcut', async ({ shortcut, ack, body, client }: any) => {
    await ack();
    try {
      const payload = shortcut || body;
      const userId = payload?.user?.id || body?.user?.id;
      const workspaceId = payload?.team?.id || body?.team?.id;
      const triggerId = payload?.trigger_id || body?.trigger_id;
      if (!triggerId) return;

      const translator = await getRequestTranslator(client, {
        userId,
        workspaceId,
      });

      let channelId = String(payload?.channel?.id || '').trim();
      let threadTs: string | null =
        String(payload?.message?.thread_ts || payload?.message?.ts || '').trim() || null;

      if (channelId && !threadTs) {
        const botToken = workspaceId
          ? await PollService.resolveWorkspaceBotToken(workspaceId)
          : undefined;
        threadTs = await findActiveHuddleThread(client, channelId, botToken);
      } else if (!channelId) {
        const cachedHuddle = getMostRecentCachedActiveHuddle();
        if (cachedHuddle) {
          channelId = cachedHuddle.channelId;
          threadTs = cachedHuddle.threadTs;
        }
      }

      await client.views.open({
        trigger_id: triggerId,
        view: buildCreatePollModalView({
          channelId,
          ...(threadTs ? { threadTs, huddleMode: true } : {}),
          translator,
        }),
      });
    } catch (error) {
      console.error('Failed to open poll modal from global shortcut:', error);
    }
  });
}

export function registerCommandHandlers(app: App) {
  registerShortcutHandlers(app);

  const handlePollitoCommand = async ({
    command,
    ack,
    client,
  }: SlackCommandMiddlewareArgs & AllMiddlewareArgs) => {
    await ack();

    const translator = await getRequestTranslator(client, {
      userId: command.user_id,
      workspaceId: command.team_id,
    });
    const { t } = translator;

    try {
      const text = command.text.trim();
      const lowerText = text.toLowerCase();
      const explicitThreadTs =
        (command as any).thread_ts || (command as any).threadTs || null;

      // 1. If text is empty, open creation modal (auto-detecting active Huddle thread if present)
      if (!text) {
        const botToken = command.team_id
          ? await PollService.resolveWorkspaceBotToken(command.team_id)
          : undefined;
        const activeHuddleTs =
          explicitThreadTs ||
          (await findActiveHuddleThread(client, command.channel_id, botToken));

        await client.views.open({
          trigger_id: command.trigger_id,
          view: buildCreatePollModalView({
            channelId: command.channel_id,
            ...(activeHuddleTs ? { threadTs: activeHuddleTs, huddleMode: true } : {}),
            translator,
          }),
        });
        return;
      }

      // 2. Help command
      if (lowerText === 'help') {
        await client.chat.postEphemeral({
          channel: command.channel_id,
          user: command.user_id,
          text: t('command.help'),
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
            text: err?.message || t('error.activePollInChannel'),
          });
          return;
        }

        const huddleRest = text.slice(6).trim();
        const leadingPart = huddleRest.split('"')[0]?.trim() || '';
        const firstToken = leadingPart.split(/\s+/)[0] || '';
        const parsedLinkTs = firstToken
          ? parseHuddleThreadInput(firstToken)
          : null;

        const botToken = command.team_id
          ? await PollService.resolveWorkspaceBotToken(command.team_id)
          : undefined;
        const huddleThreadTs =
          explicitThreadTs ||
          parsedLinkTs ||
          (await findActiveHuddleThread(client, command.channel_id, botToken));

        const huddleMatches = [...huddleRest.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

        if (huddleMatches.length >= 3) {
          if (!huddleThreadTs) {
            await client.chat.postEphemeral({
              channel: command.channel_id,
              user: command.user_id,
              text: t('command.noHuddle'),
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
              text: t('poll.fallback.creating', { question }),
            });
          } catch (error: any) {
            if (error?.data?.error === 'not_in_channel') {
              await client.chat.postEphemeral({
                channel: command.channel_id,
                user: command.user_id,
                text: t('command.inviteBot', { command: '`/pollito huddle`' }),
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
              (settings.defaultQuorumType as 'PERCENTAGE' | 'NONE') || 'NONE',
            quorumTarget: settings.defaultQuorumPct,
            eligibleVoterCount: memberCount,
            forwardToChannelOnHuddleEnd: true,
            locale: translator.locale,
          });

          const pollTranslator = getPollTranslator(poll);
          const blocks = buildPollMessageBlocks(
            {
              ...poll,
              participations: [],
            },
            {
              maxNudgeChannelMembers: settings.maxNudgeChannelMembers,
              allowVoterChoiceNudges: settings.allowVoterChoiceNudges,
              translator: pollTranslator,
            }
          );

          await client.chat.update({
            channel: command.channel_id,
            ts: placeholder.ts,
            text: pollTranslator.t('poll.fallback.active', { question }),
            blocks,
          });

          try {
            await client.chat?.postEphemeral?.({
              channel: command.channel_id,
              user: command.user_id,
              thread_ts: huddleThreadTs,
              text: pollTranslator.t('poll.creatorControls.caption', { question }),
              blocks: buildPollCreatorControlsBlocks(poll, {
                maxNudgeChannelMembers: settings.maxNudgeChannelMembers,
                allowVoterChoiceNudges: settings.allowVoterChoiceNudges,
                translator: pollTranslator,
              }),
            });
          } catch {
            // Non-fatal if ephemeral creator controls cannot be posted
          }
          return;
        }

        await client.views.open({
          trigger_id: command.trigger_id,
          view: buildCreatePollModalView({
            channelId: command.channel_id,
            threadTs: huddleThreadTs,
            huddleMode: true,
            translator,
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
              view: buildAnalyticsModalView(stats, 30, translator),
            });
          } catch (modalErr) {
            console.error('Failed to open analytics modal from /pollito report:', modalErr);
          }
        }

        await client.chat.postEphemeral({
          channel: command.channel_id,
          user: command.user_id,
          text: t('command.report.summary', {
            scope: stats.scope,
            total: stats.totalPolls,
            active: stats.totalActive,
            quorums: stats.totalQuorumsReached,
            avg: stats.avgParticipationPct,
          }),
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
            text: t('nudge.noPoll'),
          });
          return;
        }

        const closedPoll = await PollService.closePoll(poll.id, command.user_id, 'CLOSED');
        await UpdateQueue.flushNow(closedPoll.id, closedPoll.channelId, closedPoll.messageTs, client);

        const pollTranslator = getPollTranslator(closedPoll);
        await client.chat.postMessage({
          channel: closedPoll.channelId,
          thread_ts: closedPoll.threadTs || closedPoll.messageTs,
          text: formatPollClosureSummary(closedPoll, 'CLOSED', { translator: pollTranslator }),
        });

        await client.chat.postEphemeral({
          channel: command.channel_id,
          user: command.user_id,
          text: t('command.pollClosed', { question: closedPoll.question }),
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
            text: t('nudge.noPoll'),
          });
          return;
        }

        const settings = await PollService.getWorkspaceSettings(command.team_id);
        if (!settings.allowVoterChoiceNudges) {
          await client.chat.postEphemeral({
            channel: command.channel_id,
            user: command.user_id,
            text: t('nudge.disabled'),
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
            text: t('nudge.channelTooLarge', { max: settings.maxNudgeChannelMembers }),
          });
          return;
        }

        const recentNudge = await prisma.nudgeLog.findFirst({
          where: {
            pollId: poll.id,
            sentAt: { gte: new Date(Date.now() - NUDGE_COOLDOWN_HOURS * 60 * 60 * 1000) },
          },
        });

        if (recentNudge) {
          await client.chat.postEphemeral({
            channel: command.channel_id,
            user: command.user_id,
            text: t('nudge.cooldown', { hours: NUDGE_COOLDOWN_HOURS }),
          });
          return;
        }

        const nonVoters = await PollService.getNonVoters(poll.id, members);
        const recipients = nonVoters.slice(0, settings.maxNudgeChannelMembers);

        let sentCount = 0;
        for (const recipientId of recipients) {
          try {
            const recipientTranslator = await getRequestTranslator(client, {
              userId: recipientId,
              workspaceId: command.team_id,
            });
            await client.chat.postMessage({
              channel: recipientId,
              text: recipientTranslator.t('nudge.dm', {
                creatorId: poll.creatorId,
                question: poll.question,
                channelId: poll.channelId,
              }),
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
            ? t('nudge.nonePending')
            : t('nudge.sent', { count: sentCount });

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
            text: err?.message || t('error.activePollInChannel'),
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

        const botToken = command.team_id
          ? await PollService.resolveWorkspaceBotToken(command.team_id)
          : undefined;
        const targetThreadTs =
          explicitThreadTs ||
          (await findActiveHuddleThread(client, command.channel_id, botToken));

        // Initial placeholder message to reserve ts
        let placeholder;
        try {
          placeholder = await client.chat.postMessage({
            channel: command.channel_id,
            text: t('poll.fallback.creating', { question }),
            ...(targetThreadTs ? { thread_ts: targetThreadTs } : {}),
          });
        } catch (error: any) {
          if (error?.data?.error === 'not_in_channel') {
            await client.chat.postEphemeral({
              channel: command.channel_id,
              user: command.user_id,
              text: t('command.inviteBot', { command: '`/pollito`' }),
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
          ...(targetThreadTs ? { threadTs: targetThreadTs } : {}),
          creatorId: command.user_id,
          question,
          options,
          isAnonymous: false,
          quorumType: (settings.defaultQuorumType as 'PERCENTAGE' | 'NONE') || 'NONE',
          quorumTarget: settings.defaultQuorumPct,
          eligibleVoterCount: memberCount,
          locale: translator.locale,
        });

        const pollTranslator = getPollTranslator(poll);
        const blocks = buildPollMessageBlocks(
          {
            ...poll,
            participations: [],
          },
          {
            maxNudgeChannelMembers: settings.maxNudgeChannelMembers,
            allowVoterChoiceNudges: settings.allowVoterChoiceNudges,
            translator: pollTranslator,
          }
        );

        await client.chat.update({
          channel: command.channel_id,
          ts: placeholder.ts,
          text: pollTranslator.t('poll.fallback.active', { question }),
          blocks,
        });

        try {
          await client.chat?.postEphemeral?.({
            channel: command.channel_id,
            user: command.user_id,
            ...(targetThreadTs ? { thread_ts: targetThreadTs } : {}),
            text: pollTranslator.t('poll.creatorControls.caption', { question }),
            blocks: buildPollCreatorControlsBlocks(poll, {
              maxNudgeChannelMembers: settings.maxNudgeChannelMembers,
              allowVoterChoiceNudges: settings.allowVoterChoiceNudges,
              translator: pollTranslator,
            }),
          });
        } catch {
          // Non-fatal if ephemeral creator controls cannot be posted
        }
        return;
      }

      // Fallback for unrecognized syntax: open modal
      const botToken = command.team_id
        ? await PollService.resolveWorkspaceBotToken(command.team_id)
        : undefined;
      const activeHuddleTs =
        explicitThreadTs ||
        (await findActiveHuddleThread(client, command.channel_id, botToken));

      await client.views.open({
        trigger_id: command.trigger_id,
        view: buildCreatePollModalView({
          channelId: command.channel_id,
          ...(activeHuddleTs ? { threadTs: activeHuddleTs, huddleMode: true } : {}),
          translator,
        }),
      });
    } catch (error) {
      console.error('Error handling /pollito command:', error);
      const msg = error instanceof Error ? error.message : t('error.generic.command');
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
  };

  for (const name of SUBCOMMAND_ALIASES) {
    app.command(`/pollito-${name}`, async (args) => {
      const text = `${name} ${args.command.text}`.trim();
      await handlePollitoCommand({ ...args, command: { ...args.command, text } });
    });
  }
  app.command('/pollito', handlePollitoCommand);
}
