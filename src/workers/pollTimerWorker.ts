import type { App } from '@slack/bolt';
import { PollService } from '../services/pollService.js';
import { buildPollMessageBlocks } from '../slack/ui/views/pollMessage.js';
import { formatPollClosureSummary } from '../slack/utils/channelMembers.js';
import {
  findChannelHuddles,
  notifyMainChannelOnHuddleEnd,
} from '../slack/utils/huddleDiscovery.js';
import { decryptToken } from '../utils/crypto.js';
import { env } from '../config/env.js';

export class PollTimerWorker {
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private intervalMs: number;
  private app: App;

  constructor(app: App, intervalMs = 30000) {
    this.app = app;
    this.intervalMs = intervalMs;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.checkAndCloseExpiredPolls().catch((err) => {
        console.error('Error in PollTimerWorker tick:', err);
      });
      this.checkHuddleEndedPolls().catch((err) => {
        console.error('Error in checkHuddleEndedPolls tick:', err);
      });
      this.checkStaleActivePolls().catch((err) => {
        console.error('Error in checkStaleActivePolls tick:', err);
      });
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async checkAndCloseExpiredPolls(now = new Date()) {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const expiredPolls = await PollService.getExpiredActivePolls(now);

      for (const poll of expiredPolls) {
        try {
          // 1. Mark poll as closed due to TIME_EXPIRED
          const closedPoll = await PollService.closePoll(poll.id, 'SYSTEM_TIMER', 'TIME_EXPIRED');

          // 2. Update the main poll message in Slack
          const { getPollTranslator } = await import('../slack/utils/locale.js');
          const pollTranslator = getPollTranslator(closedPoll);

          const updatedBlocks = buildPollMessageBlocks(
            {
              ...closedPoll,
              participations: closedPoll.participations,
            },
            { translator: pollTranslator }
          );

          const token =
            decryptToken(poll.workspace?.botToken ?? '', env.APP_SECRET_SALT) ??
            env.SLACK_BOT_TOKEN;

          await this.app.client.chat.update({
            token,
            channel: poll.channelId,
            ts: poll.messageTs,
            text: pollTranslator.t('poll.fallback.closed', { question: poll.question }),
            blocks: updatedBlocks,
          });

          // 3. Post thread announcement (inside Huddle thread if poll was posted in a Huddle)
          const resultNotice = formatPollClosureSummary(closedPoll, 'TIME_EXPIRED', {
            translator: pollTranslator,
          });

          await this.app.client.chat.postMessage({
            token,
            channel: poll.channelId,
            thread_ts: poll.threadTs || poll.messageTs,
            text: resultNotice,
          });
        } catch (pollErr) {
          console.error(`Failed to auto-close poll ${poll.id}:`, pollErr);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  async checkHuddleEndedPolls() {
    try {
      const pendingPolls = await PollService.getActiveHuddlePollsPendingReminder();
      if (pendingPolls.length === 0) return;

      for (const poll of pendingPolls) {
        try {
          const token =
            decryptToken(poll.workspace?.botToken ?? '', env.APP_SECRET_SALT) ??
            env.SLACK_BOT_TOKEN;

          const huddles = await findChannelHuddles(
            this.app.client,
            poll.channelId,
            token
          );

          const relatedHuddle = poll.threadTs
            ? huddles.find((h) => h.ts === poll.threadTs)
            : huddles[0];

          // If no active huddles found in channel or the related huddle has ended
          const isEnded = !relatedHuddle || !relatedHuddle.isActive;
          if (isEnded) {
            await notifyMainChannelOnHuddleEnd(this.app.client, poll, token);
          }
        } catch (pollErr) {
          console.error(`Failed checking huddle status for poll ${poll.id}:`, pollErr);
        }
      }
    } catch (err) {
      console.error('Error in checkHuddleEndedPolls:', err);
    }
  }

  async checkStaleActivePolls(now = new Date()) {
    try {
      const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const stalePolls = await PollService.getStaleActivePollsPendingReminder(cutoff);
      if (stalePolls.length === 0) return;

      for (const poll of stalePolls) {
        try {
          const claimed = await PollService.claimStalePollReminder(poll.id);
          if (!claimed) continue;

          const token =
            decryptToken(poll.workspace?.botToken ?? '', env.APP_SECRET_SALT) ??
            env.SLACK_BOT_TOKEN;

          const { getRequestTranslator } = await import('../slack/utils/locale.js');
          const translator = await getRequestTranslator(this.app.client, {
            userId: poll.creatorId,
            workspaceId: poll.workspaceId,
          });
          const { t } = translator;

          let permalink = '';
          try {
            const permRes = await this.app.client.chat?.getPermalink?.({
              token,
              channel: poll.channelId,
              message_ts: poll.messageTs,
            });
            permalink = permRes?.permalink || '';
          } catch {
            // ignore
          }

          if (!permalink) {
            const cleanedTs = poll.messageTs.replace('.', '');
            permalink = `https://slack.com/archives/${poll.channelId}/p${cleanedTs}${
              poll.threadTs ? `?thread_ts=${poll.threadTs}&cid=${poll.channelId}` : ''
            }`;
          }

          await this.app.client.chat.postMessage({
            token,
            channel: poll.creatorId,
            text: t('poll.staleReminder.fallback', {
              question: poll.question,
              channelId: poll.channelId,
            }),
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: t('poll.staleReminder.body', {
                    question: poll.question,
                    channelId: poll.channelId,
                  }),
                },
              },
              {
                type: 'actions',
                elements: [
                  {
                    type: 'button',
                    text: {
                      type: 'plain_text',
                      text: t('poll.staleReminder.jump'),
                      emoji: true,
                    },
                    url: permalink,
                  },
                  {
                    type: 'button',
                    action_id: 'poll_close_click',
                    style: 'danger',
                    text: {
                      type: 'plain_text',
                      text: t('poll.staleReminder.close'),
                      emoji: true,
                    },
                    value: poll.id,
                  },
                ],
              },
            ],
          });
        } catch (pollErr) {
          console.error(`Failed to send 24h stale reminder for poll ${poll.id}:`, pollErr);
        }
      }
    } catch (err) {
      console.error('Error in checkStaleActivePolls:', err);
    }
  }
}

