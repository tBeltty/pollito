import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UpdateQueue } from '../../src/services/updateQueue.js';
import { PollService } from '../../src/services/pollService.js';
import { prisma } from '../../src/db/prisma.js';

describe('UpdateQueue', () => {
  const workspaceId = 'T_QUEUE_TEST';

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });

    await prisma.publicVote.deleteMany();
    await prisma.anonymousBallot.deleteMany();
    await prisma.pollParticipation.deleteMany();
    await prisma.pollOption.deleteMany();
    await prisma.poll.deleteMany();
    await prisma.workspaceSettings.deleteMany();
    await prisma.workspace.deleteMany();
  });

  afterEach(async () => {
    await UpdateQueue.flushAll();
    vi.useRealTimers();
  });

  it('debounces rapid updates and executes a single chat.update after DEBOUNCE_MS', async () => {
    const poll = await PollService.createPoll({
      workspaceId,
      channelId: 'C_QUEUE_1',
      messageTs: '1700000000.000100',
      creatorId: 'U_CREATOR',
      question: 'Debounce test?',
      options: ['Yes', 'No'],
    });

    const mockClient = {
      chat: {
        update: vi.fn().mockResolvedValue({ ok: true }),
      },
    } as any;

    UpdateQueue.scheduleUpdate(poll.id, poll.channelId, poll.messageTs, mockClient);
    vi.advanceTimersByTime(300);
    UpdateQueue.scheduleUpdate(poll.id, poll.channelId, poll.messageTs, mockClient);
    vi.advanceTimersByTime(300);
    UpdateQueue.scheduleUpdate(poll.id, poll.channelId, poll.messageTs, mockClient);

    vi.advanceTimersByTime(799);
    expect(mockClient.chat.update).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    await vi.waitFor(() => {
      expect(mockClient.chat.update).toHaveBeenCalledTimes(1);
    });
    expect(mockClient.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'C_QUEUE_1',
        ts: '1700000000.000100',
      })
    );
  });

  it('enforces MAX_WAIT_MS (2000ms) ceiling when continuous updates arrive', async () => {
    const poll = await PollService.createPoll({
      workspaceId,
      channelId: 'C_QUEUE_2',
      messageTs: '1700000000.000200',
      creatorId: 'U_CREATOR',
      question: 'Max wait bound test?',
      options: ['A', 'B'],
    });

    const mockClient = {
      chat: {
        update: vi.fn().mockResolvedValue({ ok: true }),
      },
    } as any;

    // t = 0ms
    UpdateQueue.scheduleUpdate(poll.id, poll.channelId, poll.messageTs, mockClient);

    // t = 600ms
    vi.advanceTimersByTime(600);
    UpdateQueue.scheduleUpdate(poll.id, poll.channelId, poll.messageTs, mockClient);

    // t = 1200ms
    vi.advanceTimersByTime(600);
    UpdateQueue.scheduleUpdate(poll.id, poll.channelId, poll.messageTs, mockClient);

    // t = 1800ms -> remaining cap is 200ms (2000 - 1800)
    vi.advanceTimersByTime(600);
    UpdateQueue.scheduleUpdate(poll.id, poll.channelId, poll.messageTs, mockClient);
    vi.advanceTimersByTime(199);
    expect(mockClient.chat.update).not.toHaveBeenCalled();

    // Advance 1ms to reach t = 2000ms -> must flush!
    vi.advanceTimersByTime(1);
    await vi.waitFor(() => {
      expect(mockClient.chat.update).toHaveBeenCalledTimes(1);
    });
  });

  it('flushNow cancels pending timer and immediately updates the message card in Slack', async () => {
    const poll = await PollService.createPoll({
      workspaceId,
      channelId: 'C_QUEUE_3',
      messageTs: '1700000000.000300',
      creatorId: 'U_CREATOR',
      question: 'Immediate flush test?',
      options: ['Ship', 'Hold'],
    });

    const mockClient = {
      chat: {
        update: vi.fn().mockResolvedValue({ ok: true }),
      },
    } as any;

    UpdateQueue.scheduleUpdate(poll.id, poll.channelId, poll.messageTs, mockClient);
    expect(mockClient.chat.update).not.toHaveBeenCalled();

    await UpdateQueue.flushNow(poll.id, poll.channelId, poll.messageTs, mockClient);
    expect(mockClient.chat.update).toHaveBeenCalledTimes(1);

    // Advancing past original debounce window should not trigger a duplicate update
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockClient.chat.update).toHaveBeenCalledTimes(1);
  });

  it('flushAll flushes all queued poll updates and clears pending timers', async () => {
    const poll1 = await PollService.createPoll({
      workspaceId,
      channelId: 'C_QUEUE_4',
      messageTs: '1700000000.000401',
      creatorId: 'U_CREATOR',
      question: 'Flush all 1?',
      options: ['Yes', 'No'],
    });

    const poll2 = await PollService.createPoll({
      workspaceId,
      channelId: 'C_QUEUE_4',
      messageTs: '1700000000.000402',
      creatorId: 'U_CREATOR',
      question: 'Flush all 2?',
      options: ['Yes', 'No'],
    });

    const mockClient = {
      chat: {
        update: vi.fn().mockResolvedValue({ ok: true }),
      },
    } as any;

    UpdateQueue.scheduleUpdate(poll1.id, poll1.channelId, poll1.messageTs, mockClient);
    UpdateQueue.scheduleUpdate(poll2.id, poll2.channelId, poll2.messageTs, mockClient);

    expect(mockClient.chat.update).not.toHaveBeenCalled();

    await UpdateQueue.flushAll();
    expect(mockClient.chat.update).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(mockClient.chat.update).toHaveBeenCalledTimes(2);
  });
});
