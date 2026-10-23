import type { App } from '@slack/bolt';
import { prisma } from '../../db/prisma.js';
import { PollService } from '../../services/pollService.js';
import { ENV_MANAGED_TOKEN } from '../../utils/crypto.js';
import { buildAppHomeView } from '../ui/views/appHome.js';
import {
  buildPollCreatorControlsBlocks,
  buildPollMessageBlocks,
} from '../ui/views/pollMessage.js';
import { getEligibleChannelMembers } from '../utils/channelMembers.js';
import {
  recordHuddleMessageEvent,
  isHuddleMessage,
  isHuddleEnded,
  notifyMainChannelOnHuddleEnd,
} from '../utils/huddleDiscovery.js';
import { getPollTranslator, getRequestTranslator } from '../utils/locale.js';

export async function publishHomeTab(
  client: any,
  userId: string,
  workspaceId: string
): Promise<void> {
  const [settings, viewer, polls, templates, botToken] = await Promise.all([
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
    PollService.listTemplates(workspaceId, userId),
    PollService.resolveWorkspaceBotToken(workspaceId),
  ]);

  const [stats, translator] = await Promise.all([
    PollService.getPollAnalyticsStats(workspaceId, viewer, 30),
    getRequestTranslator(client, { userId, workspaceId }),
  ]);

  const homeView = buildAppHomeView(polls.slice(0, 10), {
    totalActive: stats.totalActive,
    totalQuorumsReached: stats.totalQuorumsReached,
    totalClosed: stats.totalClosed,
    avgParticipationPct: stats.avgParticipationPct,
    currentUserId: userId,
    isManager: viewer.isManager,
    maxNudgeChannelMembers: settings.maxNudgeChannelMembers,
    allowVoterChoiceNudges: settings.allowVoterChoiceNudges,
    templates: templates.map((t) => ({
      id: t.id,
      name: t.name,
      isShared: t.isShared,
    })),
    translator,
  });

  await client.views.publish({
    token: botToken,
    user_id: userId,
    view: homeView,
  });
}

const greetedHuddleThreads = new Set<string>();
const processedThreadTriggers = new Set<string>();

export function clearGreetedHuddleThreads(): void {
  greetedHuddleThreads.clear();
  processedThreadTriggers.clear();
}

async function handleInThreadPollitoTrigger(
  event: any,
  body: any,
  client: any
): Promise<void> {
  if (!event || typeof event !== 'object') return;
  if (isHuddleMessage(event)) return;
  if (event.bot_id || event.app_id || event.subtype === 'bot_message') return;
  if (event.subtype && event.subtype !== 'thread_broadcast') return;

  const channelId = String(event.channel || '').trim();
  const userId = String(event.user || '').trim();
  if (!channelId || !userId) return;

  const rawText = String(event.text ?? '').trim();
  if (!rawText) return;

  const threadTs = String(event.thread_ts || '').trim();
  if (!threadTs) return;

  let isBotMention = false;
  if (event.type === 'app_mention') {
    isBotMention = true;
  } else if (/^@pollito\b/i.test(rawText)) {
    isBotMention = true;
  } else {
    const mentionMatch = rawText.match(/^<@([A-Z0-9]+)>/i);
    if (mentionMatch) {
      const mentionedId = mentionMatch[1];
      const authUser = body?.authorizations?.[0]?.user_id;
      if (authUser && mentionedId === authUser) {
        isBotMention = true;
      } else {
        try {
          const auth = await client.auth?.test?.().catch(() => null);
          if (auth?.user_id && auth.user_id === mentionedId) {
            isBotMention = true;
          }
        } catch {
          // ignore lookup errors
        }
      }
    }
  }

  const isKeywordTrigger =
    /^\/?pollito(?:-huddle)?(?:\s+huddle)?(?:\s*$|(?=\s+"))/i.test(rawText);

  if (!isBotMention && !isKeywordTrigger) {
    return;
  }

  const dedupKey = `${channelId}:${String(event.ts || threadTs)}`;
  if (processedThreadTriggers.has(dedupKey)) {
    return;
  }
  processedThreadTriggers.add(dedupKey);

  const workspaceId = String(
    body?.team_id || body?.team?.id || event.team || ''
  ).trim();

  const translator = await getRequestTranslator(client, {
    userId,
    workspaceId: workspaceId || undefined,
  });
  const { t } = translator;

  const matches = [...rawText.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

  if (matches.length >= 3 && workspaceId) {
    try {
      await PollService.assertCanCreatePollInChannel(workspaceId, channelId);
    } catch (err: any) {
      await client.chat?.postEphemeral?.({
        channel: channelId,
        user: userId,
        thread_ts: threadTs,
        text: err?.message || t('error.activePollInChannel'),
      });
      return;
    }

    const question = matches[0];
    const options = matches.slice(1, 7);

    try {
      await client.conversations?.join?.({ channel: channelId });
    } catch {
      // Safe to ignore
    }

    const members = await getEligibleChannelMembers(client, channelId);
    const memberCount = members.length > 0 ? members.length : 10;

    const placeholder = await client.chat?.postMessage?.({
      channel: channelId,
      thread_ts: threadTs,
      text: t('poll.fallback.creating', { question }),
    });

    if (!placeholder?.ts) return;

    const settings = await PollService.getWorkspaceSettings(workspaceId);

    const poll = await PollService.createPoll({
      workspaceId,
      channelId,
      messageTs: placeholder.ts,
      threadTs,
      creatorId: userId,
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

    await client.chat?.update?.({
      channel: channelId,
      ts: placeholder.ts,
      text: pollTranslator.t('poll.fallback.active', { question }),
      blocks,
    });

    try {
      await client.chat?.postEphemeral?.({
        channel: channelId,
        user: userId,
        thread_ts: threadTs,
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

  // Prompt with an interactive button in the thread to open the modal locked to this threadTs
  await client.chat?.postMessage?.({
    channel: channelId,
    thread_ts: threadTs,
    text: t('thread.prompt.fallback'),
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: t('thread.prompt.body'),
        },
        accessory: {
          type: 'button',
          action_id: 'open_huddle_poll_modal_action',
          style: 'primary',
          text: {
            type: 'plain_text',
            text: t('thread.prompt.button'),
          },
          value: JSON.stringify({ channelId, threadTs }),
        },
      },
    ],
  });
}

export function registerEventHandlers(app: App) {
  // Track Huddle thread root timestamps, post Huddle standby card, detect Huddle closure, and handle in-thread triggers
  if (typeof (app as any).event === 'function') {
    app.event('message', async ({ event, body, client }: any) => {
      try {
        recordHuddleMessageEvent(event);

        const msg = event?.message || event;
        const channelId = String(event?.channel || msg?.channel || '').trim();

        if (isHuddleMessage(event) && channelId) {
          const rootTs = String(msg?.thread_ts || msg?.ts || event?.ts || '').trim();
          const huddleKey = `${channelId}:${rootTs}`;

          if (isHuddleEnded(event)) {
            if (rootTs) {
              greetedHuddleThreads.delete(huddleKey);
            }
            const pendingPolls =
              await PollService.getActiveHuddlePollsPendingReminder(channelId);

            for (const poll of pendingPolls) {
              await notifyMainChannelOnHuddleEnd(client, poll);
            }
          } else if (rootTs && !greetedHuddleThreads.has(huddleKey)) {
            greetedHuddleThreads.add(huddleKey);

            const workspaceId = String(
              body?.team_id || body?.team?.id || event?.team || event?.team_id || ''
            ).trim();

            const settings = workspaceId
              ? await PollService.getWorkspaceSettings(workspaceId)
              : null;

            if (settings?.autoPromptHuddlePoll) {
              const userId = String(msg?.user || event?.user || '').trim();
              const translator = await getRequestTranslator(client, {
                userId: userId || undefined,
                workspaceId: workspaceId || undefined,
              });
              const { t } = translator;

              await client.chat?.postMessage?.({
                channel: channelId,
                thread_ts: rootTs,
                text: t('huddle.standby.fallback'),
                blocks: [
                  {
                    type: 'section',
                    text: {
                      type: 'mrkdwn',
                      text: t('huddle.standby.body'),
                    },
                    accessory: {
                      type: 'button',
                      action_id: 'open_huddle_poll_modal_action',
                      style: 'primary',
                      text: {
                        type: 'plain_text',
                        text: t('huddle.standby.button'),
                      },
                      value: JSON.stringify({ channelId, threadTs: rootTs }),
                    },
                  },
                ],
              });
            }
          }
          return;
        }

        await handleInThreadPollitoTrigger(event, body, client);
      } catch {
        // ignore non-critical huddle cache or thread trigger errors
      }
    });

    app.event('app_mention', async ({ event, body, client }: any) => {
      try {
        await handleInThreadPollitoTrigger(
          { ...event, type: 'app_mention' },
          body,
          client
        );
      } catch {
        // ignore non-critical mention errors
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
