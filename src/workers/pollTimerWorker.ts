import type { App } from '@slack/bolt';
import { PollService } from '../services/pollService.js';
import { buildPollMessageBlocks } from '../slack/ui/views/pollMessage.js';
import { formatPollClosureSummary } from '../slack/utils/channelMembers.js';
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
          const updatedBlocks = buildPollMessageBlocks({
            ...closedPoll,
            participations: closedPoll.participations,
          });

          const token =
            decryptToken(poll.workspace?.botToken ?? '', env.APP_SECRET_SALT) ??
            env.SLACK_BOT_TOKEN;

          await this.app.client.chat.update({
            token,
            channel: poll.channelId,
            ts: poll.messageTs,
            text: `[Closed] Poll: ${poll.question}`,
            blocks: updatedBlocks,
          });

          // 3. Post thread announcement (inside Huddle thread if poll was posted in a Huddle)
          const resultNotice = formatPollClosureSummary(closedPoll, 'TIME_EXPIRED');

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
}
