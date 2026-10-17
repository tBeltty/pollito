import type { WebClient } from '@slack/web-api';
import { prisma } from '../db/prisma.js';
import { buildPollMessageBlocks } from '../slack/ui/views/pollMessage.js';

interface QueuedUpdate {
  pollId: string;
  channelId: string;
  messageTs: string;
  client: WebClient;
  timer: NodeJS.Timeout;
}

export class UpdateQueue {
  private static pendingUpdates = new Map<string, QueuedUpdate>();
  private static readonly DEBOUNCE_MS = 800;

  /**
   * Schedules a debounced chat.update for a poll card in Slack.
   */
  static scheduleUpdate(
    pollId: string,
    channelId: string,
    messageTs: string,
    client: WebClient
  ) {
    const existing = this.pendingUpdates.get(pollId);
    if (existing) {
      clearTimeout(existing.timer);
    }

    const timer = setTimeout(async () => {
      this.pendingUpdates.delete(pollId);
      await this.flushUpdate(pollId, channelId, messageTs, client);
    }, this.DEBOUNCE_MS);

    this.pendingUpdates.set(pollId, {
      pollId,
      channelId,
      messageTs,
      client,
      timer,
    });
  }

  /**
   * Immediately flushes the latest poll state to Slack.
   */
  private static async flushUpdate(
    pollId: string,
    channelId: string,
    messageTs: string,
    client: WebClient
  ) {
    try {
      const poll = await prisma.poll.findUnique({
        where: { id: pollId },
        include: {
          options: { orderBy: { index: 'asc' } },
          participations: true,
          publicVotes: true,
        },
      });

      if (!poll) return;

      const blocks = buildPollMessageBlocks(poll);

      await client.chat.update({
        channel: channelId,
        ts: messageTs,
        text: `Poll: ${poll.question}`,
        blocks,
      });
    } catch (error) {
      console.error(`Failed to flush update for poll ${pollId}:`, error);
    }
  }
}
