import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PollService } from '../../src/services/pollService.js';
import { PollTimerWorker } from '../../src/workers/pollTimerWorker.js';
import { prisma } from '../../src/db/prisma.js';
import { env } from '../../src/config/env.js';
import {
  encryptToken,
  decryptToken,
  ENV_MANAGED_TOKEN,
} from '../../src/utils/crypto.js';

describe('PollService', () => {
  const workspaceId = 'T_TEST_123';
  const workspaceSalt = 'unit-test-workspace-salt-value-01';

  beforeEach(async () => {
    // Clean test database tables
    await prisma.publicVote.deleteMany();
    await prisma.anonymousBallot.deleteMany();
    await prisma.pollParticipation.deleteMany();
    await prisma.pollOption.deleteMany();
    await prisma.poll.deleteMany();
    await prisma.workspaceSettings.deleteMany();
    await prisma.workspace.deleteMany();

    // Seed test workspace
    await prisma.workspace.create({
      data: {
        id: workspaceId,
        teamName: 'Acme Test Team',
        botToken: ['xoxb', 'mock', 'token'].join('-'),
        settings: {
          create: {
            anonymousSalt: workspaceSalt,
          },
        },
      },
    });
  });

  describe('generateVoterToken & Token Encryption (Double-Urn Isolation)', () => {
    it('generates deterministic HMAC-SHA256 hex string', () => {
      const token1 = PollService.generateVoterToken('U123', 'P456', workspaceSalt);
      const token2 = PollService.generateVoterToken('U123', 'P456', workspaceSalt);
      expect(token1).toBe(token2);
      expect(token1).toHaveLength(64);
    });

    it('generates different tokens for different voters or polls', () => {
      const tokenA = PollService.generateVoterToken('U123', 'P456', workspaceSalt);
      const tokenB = PollService.generateVoterToken('U999', 'P456', workspaceSalt);
      const tokenC = PollService.generateVoterToken('U123', 'P789', workspaceSalt);

      expect(tokenA).not.toBe(tokenB);
      expect(tokenA).not.toBe(tokenC);
    });

    it('produces different tokens when masterSecret (APP_SECRET_SALT) differs even with identical workspaceSalt', () => {
      const tokenWithSecretA = PollService.generateVoterToken(
        'U123',
        'P456',
        workspaceSalt,
        'unit-test-salt-variant-alpha-only'
      );
      const tokenWithSecretB = PollService.generateVoterToken(
        'U123',
        'P456',
        workspaceSalt,
        'unit-test-salt-variant-bravo-only'
      );
      expect(tokenWithSecretA).not.toBe(tokenWithSecretB);
    });

    it('encrypts and decrypts xoxb- tokens with AES-256-GCM and falls back to env.SLACK_BOT_TOKEN for placeholder values', async () => {
      const rawToken = ['xoxb', 'unit', 'test', 'fixture'].join('-');
      const encrypted = encryptToken(rawToken, env.APP_SECRET_SALT);

      expect(encrypted.startsWith('enc:v1:')).toBe(true);
      expect(encrypted).not.toContain(rawToken);
      expect(decryptToken(encrypted, env.APP_SECRET_SALT)).toBe(rawToken);
      expect(decryptToken(encrypted, 'different-unit-test-key')).toBeNull();
      expect(decryptToken(ENV_MANAGED_TOKEN, env.APP_SECRET_SALT)).toBeNull();
      expect(decryptToken('bot_token_managed', env.APP_SECRET_SALT)).toBeNull();

      // Store ENV_MANAGED_TOKEN in workspace and verify resolveWorkspaceBotToken falls back to env.SLACK_BOT_TOKEN
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { botToken: ENV_MANAGED_TOKEN },
      });
      const resolvedFallback = await PollService.resolveWorkspaceBotToken(workspaceId);
      expect(resolvedFallback).toBe(env.SLACK_BOT_TOKEN);

      // Store encrypted token and verify resolveWorkspaceBotToken decrypts it
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { botToken: encrypted },
      });
      const resolvedDecrypted = await PollService.resolveWorkspaceBotToken(workspaceId);
      expect(resolvedDecrypted).toBe(rawToken);
    });
  });

  describe('createPoll', () => {
    it('creates an active poll with indexed options', async () => {
      const poll = await PollService.createPoll({
        workspaceId,
        channelId: 'C_DEV_CHANNEL',
        messageTs: '1700000000.000100',
        creatorId: 'U_CREATOR',
        question: 'Which framework should we use?',
        options: ['React', 'Vue', 'Svelte'],
        quorumTarget: 60,
        eligibleVoterCount: 10,
      });

      expect(poll.id).toBeDefined();
      expect(poll.status).toBe('ACTIVE');
      expect(poll.allowMultipleVotes).toBe(false);
      expect(poll.options).toHaveLength(3);
      expect(poll.options[0].text).toBe('React');
      expect(poll.options[0].index).toBe(0);
      expect(poll.options[0].voteCount).toBe(0);
    });
  });

  describe('castVote & getNonVoters', () => {
    it('records anonymous votes in AnonymousBallot without createdAt and records voter in PollParticipation without linking choice', async () => {
      const poll = await PollService.createPoll({
        workspaceId,
        channelId: 'C_DEV_CHANNEL',
        messageTs: '1700000000.000200',
        creatorId: 'U_CREATOR',
        question: 'Secret Ballot: Should we switch to 4-day workweek?',
        options: ['Yes', 'No'],
        isAnonymous: true,
        quorumTarget: 50,
        eligibleVoterCount: 4,
      });

      const optionYes = poll.options[0];

      // Cast vote
      const result = await PollService.castVote({
        pollId: poll.id,
        voterId: 'U_ALICE',
        optionId: optionYes.id,
        workspaceSalt,
      });

      expect(result.totalVotes).toBe(1);
      expect(result.quorumReached).toBe(false);

      // Verify voter is in participation table
      const participation = await prisma.pollParticipation.findUnique({
        where: {
          pollId_voterId: {
            pollId: poll.id,
            voterId: 'U_ALICE',
          },
        },
      });
      expect(participation).not.toBeNull();
      expect(participation?.hasVoted).toBe(true);

      // Verify AnonymousBallot table has zero plain-text voter ID and no createdAt timestamp correlation
      const ballots = await prisma.anonymousBallot.findMany({
        where: { pollId: poll.id },
      });
      expect(ballots).toHaveLength(1);
      expect(ballots[0].voterToken).toHaveLength(64);
      expect(ballots[0].optionId).toBe(optionYes.id);
      expect('createdAt' in ballots[0]).toBe(false);

      // Verify option count incremented
      const updatedOption = await prisma.pollOption.findUnique({
        where: { id: optionYes.id },
      });
      expect(updatedOption?.voteCount).toBe(1);
    });

    it('rejects duplicate vote attempts from the same user in single-choice polls', async () => {
      const poll = await PollService.createPoll({
        workspaceId,
        channelId: 'C_DEV_CHANNEL',
        messageTs: '1700000000.000300',
        creatorId: 'U_CREATOR',
        question: 'Duplicate test',
        options: ['Opt 1', 'Opt 2'],
        eligibleVoterCount: 10,
      });

      const option1 = poll.options[0];

      // First vote passes
      await PollService.castVote({
        pollId: poll.id,
        voterId: 'U_BOB',
        optionId: option1.id,
        workspaceSalt,
      });

      // Second vote from same user fails
      await expect(
        PollService.castVote({
          pollId: poll.id,
          voterId: 'U_BOB',
          optionId: option1.id,
          workspaceSalt,
        })
      ).rejects.toThrow('You have already voted in this poll');
    });

    it('supports multiple-choice voting (allowMultipleVotes: true) while counting unique participants toward quorum', async () => {
      const poll = await PollService.createPoll({
        workspaceId,
        channelId: 'C_DEV_CHANNEL',
        messageTs: '1700000000.000350',
        creatorId: 'U_CREATOR',
        question: 'Which days work for you?',
        options: ['Monday', 'Wednesday', 'Friday'],
        allowMultipleVotes: true,
        isAnonymous: true,
        quorumType: 'PERCENTAGE',
        quorumTarget: 100,
        eligibleVoterCount: 2, // Requires 2 unique voters for 100% quorum
      });

      const [mon, wed] = poll.options;

      // User 1 votes for Monday
      const res1 = await PollService.castVote({
        pollId: poll.id,
        voterId: 'U_USER_1',
        optionId: mon.id,
        workspaceSalt,
      });
      expect(res1.totalVotes).toBe(1);
      expect(res1.quorumReached).toBe(false);

      // User 1 also votes for Wednesday -> allowed, still 1 unique participant!
      const res2 = await PollService.castVote({
        pollId: poll.id,
        voterId: 'U_USER_1',
        optionId: wed.id,
        workspaceSalt,
      });
      expect(res2.totalVotes).toBe(1);
      expect(res2.quorumReached).toBe(false);

      // User 1 tries to vote for Monday a second time -> rejected
      await expect(
        PollService.castVote({
          pollId: poll.id,
          voterId: 'U_USER_1',
          optionId: mon.id,
          workspaceSalt,
        })
      ).rejects.toThrow('You have already voted for this option');

      // User 2 votes for Wednesday -> 2 unique participants = 100% quorum reached!
      const res3 = await PollService.castVote({
        pollId: poll.id,
        voterId: 'U_USER_2',
        optionId: wed.id,
        workspaceSalt,
      });
      expect(res3.totalVotes).toBe(2);
      expect(res3.quorumReached).toBe(true);
      expect(res3.poll.status).toBe('QUORUM_REACHED');
    });

    it('getNonVoters returns only eligible channel members who have not cast a vote', async () => {
      const poll = await PollService.createPoll({
        workspaceId,
        channelId: 'C_DEV_CHANNEL',
        messageTs: '1700000000.000380',
        creatorId: 'U_CREATOR',
        question: 'Nudge target test',
        options: ['Option A', 'Option B'],
        eligibleVoterCount: 4,
      });

      await PollService.castVote({
        pollId: poll.id,
        voterId: 'U_VOTED_1',
        optionId: poll.options[0].id,
        workspaceSalt,
      });
      await PollService.castVote({
        pollId: poll.id,
        voterId: 'U_VOTED_2',
        optionId: poll.options[1].id,
        workspaceSalt,
      });

      const nonVoters = await PollService.getNonVoters(poll.id, [
        'U_VOTED_1',
        'U_PENDING_1',
        'U_VOTED_2',
        'U_PENDING_2',
      ]);

      expect(nonVoters).toEqual(['U_PENDING_1', 'U_PENDING_2']);
    });

    it('automatically transitions status to QUORUM_REACHED when target is achieved', async () => {
      const poll = await PollService.createPoll({
        workspaceId,
        channelId: 'C_DEV_CHANNEL',
        messageTs: '1700000000.000400',
        creatorId: 'U_CREATOR',
        question: 'Quorum test',
        options: ['Agree', 'Disagree'],
        quorumType: 'PERCENTAGE',
        quorumTarget: 50,
        eligibleVoterCount: 2, // 1 vote = 50%, reaching quorum!
      });

      const result = await PollService.castVote({
        pollId: poll.id,
        voterId: 'U_CHARLIE',
        optionId: poll.options[0].id,
        workspaceSalt,
      });

      expect(result.quorumReached).toBe(true);
      expect(result.poll.status).toBe('QUORUM_REACHED');
      expect(result.poll.closedAt).not.toBeNull();

      // Subsequent votes are rejected
      await expect(
        PollService.castVote({
          pollId: poll.id,
          voterId: 'U_DAVE',
          optionId: poll.options[1].id,
          workspaceSalt,
        })
      ).rejects.toThrow('This poll is closed and no longer accepting votes');
    });
  });

  describe('closePoll & PollTimerWorker', () => {
    it('allows poll creator to manually close active poll', async () => {
      const poll = await PollService.createPoll({
        workspaceId,
        channelId: 'C_DEV_CHANNEL',
        messageTs: '1700000000.000500',
        creatorId: 'U_LEAD',
        question: 'Manual close test',
        options: ['A', 'B'],
      });

      const closed = await PollService.closePoll(poll.id, 'U_LEAD');
      expect(closed.status).toBe('CLOSED');
      expect(closed.closedAt).not.toBeNull();
    });

    it('allows system timer to close active poll with TIME_EXPIRED status', async () => {
      const poll = await PollService.createPoll({
        workspaceId,
        channelId: 'C_DEV_CHANNEL',
        messageTs: '1700000000.000700',
        creatorId: 'U_LEAD',
        question: 'Timer close test',
        options: ['A', 'B'],
        closesAt: new Date(Date.now() - 1000),
      });

      const closed = await PollService.closePoll(poll.id, 'SYSTEM_TIMER', 'TIME_EXPIRED');
      expect(closed.status).toBe('TIME_EXPIRED');
      expect(closed.closedAt).not.toBeNull();
    });

    it('rejects votes when closesAt deadline has already passed', async () => {
      const poll = await PollService.createPoll({
        workspaceId,
        channelId: 'C_DEV_CHANNEL',
        messageTs: '1700000000.000800',
        creatorId: 'U_LEAD',
        question: 'Expired poll test',
        options: ['A', 'B'],
        closesAt: new Date(Date.now() - 5000), // Closed 5 seconds ago
      });

      await expect(
        PollService.castVote({
          pollId: poll.id,
          voterId: 'U_LATE',
          optionId: poll.options[0].id,
          workspaceSalt,
        })
      ).rejects.toThrow('This poll is closed and no longer accepting votes');
    });

    it('getExpiredActivePolls accurately finds active polls past deadline', async () => {
      const pastDate = new Date(Date.now() - 10000);
      const futureDate = new Date(Date.now() + 60000);

      // 1. Expired poll
      const expiredPoll = await PollService.createPoll({
        workspaceId,
        channelId: 'C_DEV_CHANNEL',
        messageTs: '1700000000.000900',
        creatorId: 'U_LEAD',
        question: 'Expired poll',
        options: ['A', 'B'],
        closesAt: pastDate,
      });

      // 2. Future poll (should not be returned)
      await PollService.createPoll({
        workspaceId,
        channelId: 'C_DEV_CHANNEL',
        messageTs: '1700000000.001000',
        creatorId: 'U_LEAD',
        question: 'Future poll',
        options: ['A', 'B'],
        closesAt: futureDate,
      });

      // 3. Poll without deadline (should not be returned)
      await PollService.createPoll({
        workspaceId,
        channelId: 'C_DEV_CHANNEL',
        messageTs: '1700000000.001100',
        creatorId: 'U_LEAD',
        question: 'No deadline poll',
        options: ['A', 'B'],
        closesAt: null,
      });

      const expiredList = await PollService.getExpiredActivePolls();
      expect(expiredList).toHaveLength(1);
      expect(expiredList[0].id).toBe(expiredPoll.id);
    });

    it('PollTimerWorker resolves placeholder workspace botToken to valid xoxb- token and never passes bot_token_managed', async () => {
      // Create poll in a newly auto-upserted workspace (which gets ENV_MANAGED_TOKEN)
      const autoWorkspaceId = 'T_AUTO_UPSERT_WS';
      await PollService.createPoll({
        workspaceId: autoWorkspaceId,
        channelId: 'C_TIMER_CH',
        messageTs: '1700000000.001200',
        creatorId: 'U_LEAD',
        question: 'Auto-close token test',
        options: ['Opt 1', 'Opt 2'],
        closesAt: new Date(Date.now() - 5000),
      });

      // Also test legacy 'bot_token_managed' value
      await prisma.workspace.update({
        where: { id: autoWorkspaceId },
        data: { botToken: 'bot_token_managed' },
      });

      const updateSpy = vi.fn().mockResolvedValue({ ok: true });
      const postMessageSpy = vi.fn().mockResolvedValue({ ok: true });

      const mockApp = {
        client: {
          chat: {
            update: updateSpy,
            postMessage: postMessageSpy,
          },
        },
      } as any;

      const worker = new PollTimerWorker(mockApp, 30000);
      await worker.checkAndCloseExpiredPolls(new Date());

      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(postMessageSpy).toHaveBeenCalledTimes(1);

      const updateArgs = updateSpy.mock.calls[0][0];
      const postArgs = postMessageSpy.mock.calls[0][0];

      expect(updateArgs.token).toBe(env.SLACK_BOT_TOKEN);
      expect(updateArgs.token).not.toBe('bot_token_managed');
      expect(updateArgs.token.startsWith('xoxb-')).toBe(true);
      expect(postArgs.token).toBe(env.SLACK_BOT_TOKEN);
    });
  });
});
