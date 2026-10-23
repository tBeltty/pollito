import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PollService,
  MIN_QUORUM_PERCENTAGE,
  DEFAULT_MAX_NUDGE_MEMBERS,
} from '../../src/services/pollService.js';
import {
  isHuddleMessage,
  isHuddleEnded,
  findChannelHuddles,
  findActiveHuddleThread,
} from '../../src/slack/utils/huddleDiscovery.js';
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
    await prisma.pollTemplate.deleteMany();
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
        installedByUserId: 'U_INSTALLER',
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

  describe('createPoll & Single Active Poll Per Channel Policy', () => {
    it('creates an active poll with indexed options and clamps PERCENTAGE quorumTarget to >= 51', async () => {
      const poll = await PollService.createPoll({
        workspaceId,
        channelId: 'C_DEV_CHANNEL',
        messageTs: '1700000000.000100',
        threadTs: '1700000000.000050',
        creatorId: 'U_CREATOR',
        question: 'Which framework should we use?',
        options: ['React', 'Vue', 'Svelte'],
        quorumTarget: 50, // Clamped to MIN_QUORUM_PERCENTAGE (51)
        eligibleVoterCount: 10,
      });

      expect(poll.id).toBeDefined();
      expect(poll.status).toBe('ACTIVE');
      expect(poll.threadTs).toBe('1700000000.000050');
      expect(poll.quorumTarget).toBe(MIN_QUORUM_PERCENTAGE);
      expect(poll.allowMultipleVotes).toBe(false);
      expect(poll.options).toHaveLength(3);
      expect(poll.options[0].text).toBe('React');
      expect(poll.options[0].index).toBe(0);
      expect(poll.options[0].voteCount).toBe(0);
    });

    it('enforces single active poll per channel unless allowMultipleActivePolls is enabled in WorkspaceSettings', async () => {
      const firstPoll = await PollService.createPoll({
        workspaceId,
        channelId: 'C_SINGLE_POLL',
        messageTs: '1700000000.000110',
        creatorId: 'U_CREATOR',
        question: 'First active poll',
        options: ['Yes', 'No'],
        enforceChannelConcurrency: true,
      });

      expect(firstPoll.status).toBe('ACTIVE');

      // Second active poll in the same channel is blocked by default
      await expect(
        PollService.createPoll({
          workspaceId,
          channelId: 'C_SINGLE_POLL',
          messageTs: '1700000000.000120',
          creatorId: 'U_CREATOR',
          question: 'Second active poll',
          options: ['Yes', 'No'],
          enforceChannelConcurrency: true,
        })
      ).rejects.toThrow(
        'An active poll is already running in this channel. Close it first or select another channel.'
      );

      // Enable allowMultipleActivePolls in WorkspaceSettings
      await PollService.updateWorkspaceSettings(workspaceId, {
        allowMultipleActivePolls: true,
      });

      const secondPoll = await PollService.createPoll({
        workspaceId,
        channelId: 'C_SINGLE_POLL',
        messageTs: '1700000000.000130',
        creatorId: 'U_CREATOR',
        question: 'Second active poll allowed',
        options: ['Yes', 'No'],
        enforceChannelConcurrency: true,
      });
      expect(secondPoll.status).toBe('ACTIVE');
    });
  });

  describe('castVote, Strict >50% Quorum, Optional Quorum (NONE), & getNonVoters', () => {
    it('records anonymous votes in AnonymousBallot without createdAt and records voter in PollParticipation without linking choice', async () => {
      const poll = await PollService.createPoll({
        workspaceId,
        channelId: 'C_DEV_CHANNEL',
        messageTs: '1700000000.000200',
        creatorId: 'U_CREATOR',
        question: 'Secret Ballot: Should we switch to 4-day workweek?',
        options: ['Yes', 'No'],
        isAnonymous: true,
        quorumTarget: 60,
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

    it('enforces strict >50% quorum: 50% (1 of 2 voters) NEVER reaches quorum, while >50% (2 of 2 or 2 of 3 at 66%) reaches QUORUM_REACHED', async () => {
      const pollTwoVoters = await PollService.createPoll({
        workspaceId,
        channelId: 'C_DEV_CHANNEL',
        messageTs: '1700000000.000400',
        creatorId: 'U_CREATOR',
        question: 'Strict majority test (2 eligible)',
        options: ['Agree', 'Disagree'],
        quorumType: 'PERCENTAGE',
        quorumTarget: 51,
        eligibleVoterCount: 2,
      });

      // 1 of 2 voters = 50% -> MUST NOT reach quorum
      const firstVote = await PollService.castVote({
        pollId: pollTwoVoters.id,
        voterId: 'U_CHARLIE',
        optionId: pollTwoVoters.options[0].id,
        workspaceSalt,
      });
      expect(firstVote.quorumReached).toBe(false);
      expect(firstVote.poll.status).toBe('ACTIVE');

      // 2 of 2 voters = 100% (>50%) -> reaches quorum
      const secondVote = await PollService.castVote({
        pollId: pollTwoVoters.id,
        voterId: 'U_DAVE',
        optionId: pollTwoVoters.options[0].id,
        workspaceSalt,
      });
      expect(secondVote.quorumReached).toBe(true);
      expect(secondVote.poll.status).toBe('QUORUM_REACHED');
      expect(secondVote.poll.closedAt).not.toBeNull();

      // Subsequent votes are rejected once closed
      await expect(
        PollService.castVote({
          pollId: pollTwoVoters.id,
          voterId: 'U_EVE',
          optionId: pollTwoVoters.options[1].id,
          workspaceSalt,
        })
      ).rejects.toThrow('This poll is closed and no longer accepting votes');

      // Also verify 3 voters at 66% quorumTarget: 1 vote (33%) does not reach quorum, 2 votes (66.7%) reaches quorum
      const pollThreeVoters = await PollService.createPoll({
        workspaceId,
        channelId: 'C_DEV_CHANNEL',
        messageTs: '1700000000.000410',
        creatorId: 'U_CREATOR',
        question: 'Two-thirds test (3 eligible)',
        options: ['Ship', 'Hold'],
        quorumType: 'PERCENTAGE',
        quorumTarget: 66,
        eligibleVoterCount: 3,
      });

      const v1 = await PollService.castVote({
        pollId: pollThreeVoters.id,
        voterId: 'U_1',
        optionId: pollThreeVoters.options[0].id,
        workspaceSalt,
      });
      expect(v1.quorumReached).toBe(false);

      const v2 = await PollService.castVote({
        pollId: pollThreeVoters.id,
        voterId: 'U_2',
        optionId: pollThreeVoters.options[0].id,
        workspaceSalt,
      });
      expect(v2.quorumReached).toBe(true);
      expect(v2.poll.status).toBe('QUORUM_REACHED');
    });

    it('never auto-closes on votes when quorumType is NONE (Optional Quorum)', async () => {
      const pollNoQuorum = await PollService.createPoll({
        workspaceId,
        channelId: 'C_DEV_CHANNEL',
        messageTs: '1700000000.000420',
        creatorId: 'U_CREATOR',
        question: 'Open pulse check without quorum',
        options: ['Great', 'Okay'],
        quorumType: 'NONE',
        quorumTarget: 0,
        eligibleVoterCount: 2,
      });

      const vote1 = await PollService.castVote({
        pollId: pollNoQuorum.id,
        voterId: 'U_1',
        optionId: pollNoQuorum.options[0].id,
        workspaceSalt,
      });
      expect(vote1.quorumReached).toBe(false);
      expect(vote1.poll.status).toBe('ACTIVE');

      const vote2 = await PollService.castVote({
        pollId: pollNoQuorum.id,
        voterId: 'U_2',
        optionId: pollNoQuorum.options[1].id,
        workspaceSalt,
      });
      expect(vote2.quorumReached).toBe(false);
      expect(vote2.poll.status).toBe('ACTIVE');
    });
  });

  describe('Workspace Governance, Analytics Scoping, & Customizable CSV Filtering', () => {
    it('identifies Workspace Managers via installer ID, delegated managerUserIds, or Slack admin flags', async () => {
      const nonAdminClient = {
        users: {
          info: vi.fn().mockResolvedValue({
            user: { is_admin: false, is_owner: false, is_primary_owner: false },
          }),
        },
      };
      const adminClient = {
        users: {
          info: vi.fn().mockResolvedValue({
            user: { is_admin: true, is_owner: false, is_primary_owner: false },
          }),
        },
      };

      // 1. Installer is automatically a manager
      expect(
        await PollService.isUserWorkspaceManager(
          nonAdminClient,
          'U_INSTALLER',
          workspaceId
        )
      ).toBe(true);

      // 2. Standard member is not a manager
      expect(
        await PollService.isUserWorkspaceManager(
          nonAdminClient,
          'U_REGULAR',
          workspaceId
        )
      ).toBe(false);

      // 3. Delegated Bot Manager in WorkspaceSettings is a manager
      const updatedSettings = await PollService.updateWorkspaceSettings(
        workspaceId,
        {
          managerUserIds: ['U_DELEGATED_MGR'],
          maxNudgeChannelMembers: 75,
        }
      );
      expect(updatedSettings.maxNudgeChannelMembers).toBe(75);
      expect(updatedSettings.managerUserIds).toEqual(['U_DELEGATED_MGR']);
      expect(
        await PollService.isUserWorkspaceManager(
          nonAdminClient,
          'U_DELEGATED_MGR',
          workspaceId
        )
      ).toBe(true);

      // 4. Slack Admin is a manager
      expect(
        await PollService.isUserWorkspaceManager(
          adminClient,
          'U_SLACK_ADMIN',
          workspaceId
        )
      ).toBe(true);
    });

    it('defaults autoPromptHuddlePoll to false and updates it via updateWorkspaceSettings', async () => {
      const initialSettings = await PollService.getWorkspaceSettings(workspaceId);
      expect(initialSettings.autoPromptHuddlePoll).toBe(false);

      const updated = await PollService.updateWorkspaceSettings(workspaceId, {
        autoPromptHuddlePoll: true,
      });
      expect(updated.autoPromptHuddlePoll).toBe(true);

      const refetched = await PollService.getWorkspaceSettings(workspaceId);
      expect(refetched.autoPromptHuddlePoll).toBe(true);

      await PollService.updateWorkspaceSettings(workspaceId, {
        autoPromptHuddlePoll: false,
      });
      const disabled = await PollService.getWorkspaceSettings(workspaceId);
      expect(disabled.autoPromptHuddlePoll).toBe(false);
    });

    it('scopes getPollAnalyticsStats to personal polls for standard members and all workspace polls for managers', async () => {
      const p1 = await PollService.createPoll({
        workspaceId,
        channelId: 'C_1',
        messageTs: '1700000000.001001',
        creatorId: 'U_ALICE',
        question: 'Alice Poll',
        options: ['Yes', 'No'],
        eligibleVoterCount: 3,
      });
      await PollService.createPoll({
        workspaceId,
        channelId: 'C_2',
        messageTs: '1700000000.001002',
        creatorId: 'U_BOB',
        question: 'Bob Poll',
        options: ['Option 1', 'Option 2'],
        isAnonymous: true,
        eligibleVoterCount: 4,
      });

      await PollService.castVote({
        pollId: p1.id,
        voterId: 'U_V1',
        optionId: p1.options[0].id,
        workspaceSalt,
      });

      const aliceViewer = { userId: 'U_ALICE', isManager: false };
      const managerViewer = { userId: 'U_INSTALLER', isManager: true };

      const aliceStats = await PollService.getPollAnalyticsStats(
        workspaceId,
        aliceViewer,
        30
      );
      expect(aliceStats.scope).toBe('personal');
      expect(aliceStats.totalPolls).toBe(1);
      expect(aliceStats.polls[0].creatorId).toBe('U_ALICE');
      expect(aliceStats.totalBallotsCast).toBe(1);

      const managerStats = await PollService.getPollAnalyticsStats(
        workspaceId,
        managerViewer,
        30
      );
      expect(managerStats.scope).toBe('workspace');
      expect(managerStats.totalPolls).toBe(2);
      expect(managerStats.publicPollsCount).toBe(1);
      expect(managerStats.anonymousPollsCount).toBe(1);
    });

    it('filters polls deterministically for CSV export by date range, status, and selectedPollIds', () => {
      const samplePolls = [
        {
          id: 'P_JAN',
          status: 'QUORUM_REACHED',
          createdAt: new Date('2026-01-15T12:00:00.000Z'),
        },
        {
          id: 'P_FEB',
          status: 'CLOSED',
          createdAt: new Date('2026-02-10T12:00:00.000Z'),
        },
        {
          id: 'P_MAR',
          status: 'ACTIVE',
          createdAt: new Date('2026-03-20T12:00:00.000Z'),
        },
      ];

      // Filter by date range
      const febAndMar = PollService.filterPollsForCsv(samplePolls, {
        startDate: '2026-02-01',
        endDate: '2026-03-31',
      });
      expect(febAndMar.map((p) => p.id)).toEqual(['P_FEB', 'P_MAR']);

      // Filter by QUORUM_REACHED status
      const quorumOnly = PollService.filterPollsForCsv(samplePolls, {
        statusFilter: 'QUORUM_REACHED',
      });
      expect(quorumOnly.map((p) => p.id)).toEqual(['P_JAN']);

      // Filter by CLOSED status (includes CLOSED, TIME_EXPIRED, QUORUM_REACHED)
      const closedPolls = PollService.filterPollsForCsv(samplePolls, {
        statusFilter: 'CLOSED',
      });
      expect(closedPolls.map((p) => p.id)).toEqual(['P_JAN', 'P_FEB']);

      // Filter by specific poll IDs
      const specificPolls = PollService.filterPollsForCsv(samplePolls, {
        selectedPollIds: ['P_MAR'],
      });
      expect(specificPolls.map((p) => p.id)).toEqual(['P_MAR']);
    });
  });

  describe('PollTemplate CRUD & Workspace Sharing', () => {
    it('supports saving, listing (personal + shared), duplicating, sharing/unsharing, unpublishing, and deleting templates', async () => {
      // Alice saves a private template
      const aliceTpl = await PollService.saveTemplate({
        workspaceId,
        ownerUserId: 'U_ALICE',
        name: 'Sprint Retro Vote',
        channelId: 'C_ENG',
        question: 'How did the sprint go?',
        options: ['Smooth', 'Challenging', 'Blocked'],
        isAnonymous: true,
        allowMultipleVotes: false,
        quorumType: 'PERCENTAGE',
        quorumTarget: 75,
        duration: '24h',
        isShared: false,
      });

      expect(aliceTpl.id).toBeDefined();
      expect(aliceTpl.options).toEqual(['Smooth', 'Challenging', 'Blocked']);
      expect(aliceTpl.isShared).toBe(false);

      // Bob cannot see Alice's private template
      const bobListBefore = await PollService.listTemplates(
        workspaceId,
        'U_BOB'
      );
      expect(bobListBefore).toHaveLength(0);

      // Alice shares her template with the workspace
      const sharedTpl = await PollService.setTemplateShared(
        aliceTpl.id,
        workspaceId,
        'U_ALICE',
        true
      );
      expect(sharedTpl.isShared).toBe(true);

      // Bob can now see and duplicate the shared template
      const bobListAfter = await PollService.listTemplates(
        workspaceId,
        'U_BOB'
      );
      expect(bobListAfter).toHaveLength(1);
      expect(bobListAfter[0].id).toBe(aliceTpl.id);

      const bobCopy = await PollService.duplicateTemplate(
        aliceTpl.id,
        workspaceId,
        'U_BOB'
      );
      expect(bobCopy.ownerUserId).toBe('U_BOB');
      expect(bobCopy.name).toBe('Sprint Retro Vote (Copy)');
      expect(bobCopy.isShared).toBe(false);

      // Workspace Manager can unpublish Alice's shared template
      const unpublished = await PollService.unpublishTemplate(
        aliceTpl.id,
        workspaceId
      );
      expect(unpublished.isShared).toBe(false);

      // Alice deletes her template
      await PollService.deleteTemplate(aliceTpl.id, workspaceId, 'U_ALICE');
      const deletedCheck = await PollService.getTemplate(
        aliceTpl.id,
        workspaceId,
        'U_ALICE'
      );
      expect(deletedCheck).toBeNull();
    });
  });

  describe('Huddle Discovery Utility', () => {
    it('accurately detects active and ended Slack Huddle threads while ignoring bot messages', async () => {
      expect(
        isHuddleMessage({
          bot_id: 'B123',
          text: 'Someone started a huddle',
        })
      ).toBe(false);

      expect(
        isHuddleMessage({
          ts: '1700000100.000100',
          subtype: 'huddle_thread',
          user: 'U_HOST',
          room: {
            id: 'R_1',
            name: 'Architecture Sync',
            created_by: 'U_HOST',
            date_start: 1700000100,
            has_ended: false,
            participants: ['U_HOST'],
          },
        })
      ).toBe(true);

      expect(
        isHuddleEnded({
          ts: '1700000050.000100',
          subtype: 'huddle_thread',
          room: {
            id: 'R_0',
            has_ended: true,
            date_end: 1700000090,
          },
        })
      ).toBe(true);

      const mockClient = {
        conversations: {
          join: vi.fn().mockResolvedValue({ ok: true }),
          history: vi.fn().mockResolvedValue({
            ok: true,
            messages: [
              {
                ts: '1700000200.000100',
                subtype: 'huddle_thread',
                user: 'U_ACTIVE_HOST',
                room: {
                  id: 'R_ACTIVE',
                  name: 'Incident Huddle',
                  created_by: 'U_ACTIVE_HOST',
                  date_start: 1700000200,
                  has_ended: false,
                  participants: ['U_ACTIVE_HOST'],
                },
              },
              {
                ts: '1700000100.000100',
                subtype: 'huddle_thread',
                user: 'U_PAST_HOST',
                room: {
                  id: 'R_ENDED',
                  created_by: 'U_PAST_HOST',
                  date_start: 1700000100,
                  has_ended: true,
                },
              },
            ],
          }),
        },
      };

      const huddles = await findChannelHuddles(mockClient, 'C_HUDDLE_CH');
      expect(huddles).toHaveLength(2);
      expect(huddles[0].ts).toBe('1700000200.000100');
      expect(huddles[0].isActive).toBe(true);
      expect(huddles[0].roomName).toBe('Incident Huddle');
      expect(huddles[1].isActive).toBe(false);

      const activeTs = await findActiveHuddleThread(mockClient, 'C_HUDDLE_CH');
      expect(activeTs).toBe('1700000200.000100');
    });
  });

  describe('closePoll & PollTimerWorker', () => {
    it('allows poll creator or Workspace Manager to manually close active poll', async () => {
      const poll = await PollService.createPoll({
        workspaceId,
        channelId: 'C_DEV_CHANNEL',
        messageTs: '1700000000.000500',
        creatorId: 'U_LEAD',
        question: 'Manual close test',
        options: ['A', 'B'],
      });

      // Non-creator without manager flag cannot close
      await expect(
        PollService.closePoll(poll.id, 'U_OTHER', 'CLOSED', false)
      ).rejects.toThrow('Only the poll creator can manually close this poll');

      // Manager can close even if not creator
      const closed = await PollService.closePoll(
        poll.id,
        'U_MANAGER',
        'CLOSED',
        true
      );
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

  describe('App Home History Deletion & Huddle End Reminder Workflow', () => {
    it('deletes an individual poll when requested by the creator or workspace manager', async () => {
      const poll = await PollService.createPoll({
        workspaceId,
        channelId: 'C_DEL_TEST',
        messageTs: '1700000000.002001',
        creatorId: 'U_OWNER_1',
        question: 'Poll to be deleted',
        options: ['Yes', 'No'],
      });

      // Regular user cannot delete another person's poll
      await expect(PollService.deletePoll(poll.id, 'U_OTHER_USER', false)).rejects.toThrow(
        /Only the poll creator or a workspace admin can delete this poll/
      );

      // Creator can delete their poll
      const deleted = await PollService.deletePoll(poll.id, 'U_OWNER_1', false);
      expect(deleted.id).toBe(poll.id);

      const check = await prisma.poll.findUnique({ where: { id: poll.id } });
      expect(check).toBeNull();
    });

    it('bulk deletes multiple authorized polls and clears closed polls without deleting active ones', async () => {
      const p1 = await PollService.createPoll({
        workspaceId,
        channelId: 'C_BULK_TEST',
        messageTs: '1700000000.002002',
        creatorId: 'U_OWNER_2',
        question: 'Poll Bulk 1',
        options: ['A', 'B'],
      });
      const p2 = await PollService.createPoll({
        workspaceId,
        channelId: 'C_BULK_TEST',
        messageTs: '1700000000.002003',
        creatorId: 'U_OWNER_2',
        question: 'Poll Bulk 2',
        options: ['A', 'B'],
      });

      // Bulk delete both
      const bulkRes = await PollService.deletePollsBulk(
        [p1.id, p2.id],
        workspaceId,
        'U_OWNER_2',
        false
      );
      expect(bulkRes.deletedPolls).toHaveLength(2);

      // Clear closed polls test
      const activePoll = await PollService.createPoll({
        workspaceId,
        channelId: 'C_BULK_TEST',
        messageTs: '1700000000.002004',
        creatorId: 'U_OWNER_2',
        question: 'Active Poll',
        options: ['1', '2'],
      });
      const closedPoll = await PollService.createPoll({
        workspaceId,
        channelId: 'C_BULK_TEST',
        messageTs: '1700000000.002005',
        creatorId: 'U_OWNER_2',
        question: 'Closed Poll',
        options: ['1', '2'],
      });
      await PollService.closePoll(closedPoll.id, 'U_OWNER_2', 'CLOSED');

      const clearRes = await PollService.clearClosedPolls(workspaceId, 'U_OWNER_2', false);
      expect(clearRes.deletedCount).toBeGreaterThanOrEqual(1);

      // Verify active poll still exists
      const remainingActive = await prisma.poll.findUnique({ where: { id: activePoll.id } });
      expect(remainingActive).not.toBeNull();
      expect(remainingActive?.status).toBe('ACTIVE');
    });

    it('queries active Huddle polls needing reminder and atomically claims reminder to avoid duplicate messages', async () => {
      const huddlePoll = await PollService.createPoll({
        workspaceId,
        channelId: 'C_HUDDLE_REMINDER_TEST',
        messageTs: '1700000000.002010',
        threadTs: '1700000000.002000',
        creatorId: 'U_HUDDLE_CREATOR',
        question: 'Pending Huddle Poll',
        options: ['Agree', 'Disagree'],
        forwardToChannelOnHuddleEnd: true,
      });

      const pendingList = await PollService.getActiveHuddlePollsPendingReminder('C_HUDDLE_REMINDER_TEST');
      expect(pendingList.some((p) => p.id === huddlePoll.id)).toBe(true);

      // First claim succeeds
      const claimedFirst = await PollService.claimHuddleEndReminder(huddlePoll.id);
      expect(claimedFirst).toBe(true);

      // Second claim returns false (preventing race condition)
      const claimedSecond = await PollService.claimHuddleEndReminder(huddlePoll.id);
      expect(claimedSecond).toBe(false);

      // Poll is no longer in pending list
      const afterClaimList = await PollService.getActiveHuddlePollsPendingReminder('C_HUDDLE_REMINDER_TEST');
      expect(afterClaimList.some((p) => p.id === huddlePoll.id)).toBe(false);
    });
  });
});
