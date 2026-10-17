import { describe, it, expect, beforeEach } from 'vitest';
import { PollService } from '../../src/services/pollService.js';
import { prisma } from '../../src/db/prisma.js';

describe('PollService', () => {
  const workspaceId = 'T_TEST_123';
  const workspaceSalt = 'test_salt_aabbccddeeff00112233';

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
        botToken: 'xoxb-mock-token',
        settings: {
          create: {
            anonymousSalt: workspaceSalt,
          },
        },
      },
    });
  });

  describe('generateVoterToken (Double-Urn Isolation)', () => {
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
      expect(poll.options).toHaveLength(3);
      expect(poll.options[0].text).toBe('React');
      expect(poll.options[0].index).toBe(0);
      expect(poll.options[0].voteCount).toBe(0);
    });
  });

  describe('castVote', () => {
    it('records anonymous votes in AnonymousBallot and records voter in PollParticipation without linking choice', async () => {
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

      // Verify AnonymousBallot table has zero plain-text voter ID
      const ballots = await prisma.anonymousBallot.findMany({
        where: { pollId: poll.id },
      });
      expect(ballots).toHaveLength(1);
      expect(ballots[0].voterToken).toHaveLength(64);
      expect(ballots[0].optionId).toBe(optionYes.id);

      // Verify option count incremented
      const updatedOption = await prisma.pollOption.findUnique({
        where: { id: optionYes.id },
      });
      expect(updatedOption?.voteCount).toBe(1);
    });

    it('rejects duplicate vote attempts from the same user', async () => {
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

  describe('closePoll', () => {
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

    it('rejects manual close attempts by unauthorized non-creators', async () => {
      const poll = await PollService.createPoll({
        workspaceId,
        channelId: 'C_DEV_CHANNEL',
        messageTs: '1700000000.000600',
        creatorId: 'U_LEAD',
        question: 'Unauthorized test',
        options: ['A', 'B'],
      });

      await expect(PollService.closePoll(poll.id, 'U_IMPOSTER')).rejects.toThrow(
        'Only the poll creator can manually close this poll'
      );
    });
  });
});
