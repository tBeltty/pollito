import type { WebClient } from '@slack/web-api';
import { prisma } from '../db/prisma.js';
import { buildPollMessageBlocks } from '../slack/ui/views/pollMessage.js';

interface QueuedUpdate {
  pollId: string;
  channelId: string;
  messageTs: string;
  client: WebClient;
  timer: NodeJS.Timeout;
  firstQueuedAt: number;
}

export class UpdateQueue {
  private static pendingUpdates = new Map<string, QueuedUpdate>();
  private static readonly DEBOUNCE_MS = 800;
  private static readonly MAX_WAIT_MS = 2000;

  /**
   * Schedules a debounced chat.update for a poll card in Slack, bounded by MAX_WAIT_MS.
   */
  static scheduleUpdate(
    pollId: string,
    channelId: string,
    messageTs: string,
    client: WebClient
  ) {
    const existing = this.pendingUpdates.get(pollId);
    const now = Date.now();
    const firstQueuedAt = existing ? existing.firstQueuedAt : now;

    if (existing) {
      clearTimeout(existing.timer);
    }

    const elapsed = now - firstQueuedAt;
    const delay = Math.max(0, Math.min(this.DEBOUNCE_MS, this.MAX_WAIT_MS - elapsed));

    const timer = setTimeout(async () => {
      this.pendingUpdates.delete(pollId);
      await this.flushUpdate(pollId, channelId, messageTs, client);
    }, delay);

    this.pendingUpdates.set(pollId, {
      pollId,
      channelId,
      messageTs,
      client,
      timer,
      firstQueuedAt,
    });
  }

  /**
   * Cancels any pending timer for the poll and immediately updates the message card in Slack.
   */
  static async flushNow(
    pollId: string,
    channelId: string,
    messageTs: string,
    client: WebClient
  ): Promise<void> {
    const existing = this.pendingUpdates.get(pollId);
    if (existing) {
      clearTimeout(existing.timer);
      this.pendingUpdates.delete(pollId);
    }
    await this.flushUpdate(pollId, channelId, messageTs, client);
  }

  /**
   * Flushes all queued poll updates immediately (e.g. during graceful shutdown).
   */
  static async flushAll(): Promise<void> {
    const entries = Array.from(this.pendingUpdates.values());
    for (const entry of entries) {
      clearTimeout(entry.timer);
    }
    this.pendingUpdates.clear();
    await Promise.allSettled(
      entries.map((e) => this.flushUpdate(e.pollId, e.channelId, e.messageTs, e.client))
    );
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
