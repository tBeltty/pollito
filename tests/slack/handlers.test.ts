import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '../../src/db/prisma.js';
import { PollService } from '../../src/services/pollService.js';
import { UpdateQueue } from '../../src/services/updateQueue.js';
import {
  getEligibleChannelMembers,
  formatPollClosureSummary,
} from '../../src/slack/utils/channelMembers.js';
import { registerActionHandlers } from '../../src/slack/handlers/actions.js';
import { registerCommandHandlers } from '../../src/slack/handlers/commands.js';
import {
  registerViewHandlers,
  createPollSubmissionSchema,
} from '../../src/slack/handlers/views.js';
import { publishHomeTab } from '../../src/slack/handlers/events.js';

describe('Slack Handlers & Channel Member Governance', () => {
  const workspaceId = 'T_SLACK_HANDLERS_TEST';
  const workspaceSalt = 'test_salt_slack_handlers_12345';

  beforeEach(async () => {
    await prisma.nudgeLog.deleteMany();
    await prisma.publicVote.deleteMany();
    await prisma.anonymousBallot.deleteMany();
    await prisma.pollParticipation.deleteMany();
    await prisma.pollOption.deleteMany();
    await prisma.poll.deleteMany();
    await prisma.pollTemplate.deleteMany();
    await prisma.workspaceSettings.deleteMany();
    await prisma.workspace.deleteMany();

    await prisma.workspace.create({
      data: {
        id: workspaceId,
        teamName: 'Handlers Test Team',
        botToken: ['xoxb', 'mock', 'handlers', 'token'].join('-'),
        settings: {
          create: {
            anonymousSalt: workspaceSalt,
          },
        },
      },
    });
  });

  describe('getEligibleChannelMembers', () => {
    it('excludes bot user ID returned by auth.test and handles pagination', async () => {
      const mockClient = {
        auth: {
          test: vi.fn().mockResolvedValue({ user_id: 'B_POLLITO' }),
        },
        conversations: {
          members: vi
            .fn()
            .mockResolvedValueOnce({
              members: ['U_ALICE', 'U_BOB', 'B_POLLITO'],
              response_metadata: { next_cursor: 'page2_cursor' },
            })
            .mockResolvedValueOnce({
              members: ['U_CHARLIE', 'B_POLLITO'],
              response_metadata: {},
            }),
        },
      } as any;

      const members = await getEligibleChannelMembers(mockClient, 'C_CHANNEL_1');

      expect(mockClient.auth.test).toHaveBeenCalledTimes(1);
      expect(mockClient.conversations.members).toHaveBeenCalledTimes(2);
      expect(members).toEqual(['U_ALICE', 'U_BOB', 'U_CHARLIE']);
      expect(members).not.toContain('B_POLLITO');
    });

    it('returns empty array when conversations.members throws', async () => {
      const mockClient = {
        auth: {
          test: vi.fn().mockResolvedValue({ user_id: 'B_POLLITO' }),
        },
        conversations: {
          members: vi.fn().mockRejectedValue(new Error('missing_scope')),
        },
      } as any;

      const members = await getEligibleChannelMembers(mockClient, 'C_CHANNEL_ERR');
      expect(members).toEqual([]);
    });
  });

  describe('formatPollClosureSummary', () => {
    const mockPoll = {
      question: 'Sprint Retro Date',
      options: [
        { text: 'Thursday 2pm', voteCount: 5 },
        { text: 'Friday 10am', voteCount: 2 },
      ],
      participations: [{ voterId: 'U1' }, { voterId: 'U2' }, { voterId: 'U3' }],
    };

    it('formats QUORUM_REACHED summary with winning option and vote counts', () => {
      const summary = formatPollClosureSummary(mockPoll, 'QUORUM_REACHED');
      expect(summary).toContain('🎉 *Quorum reached. Poll closed*');
      expect(summary).toContain('*Sprint Retro Date*');
      expect(summary).toContain('*3* participants');
      expect(summary).toContain('Winner: *Thursday 2pm* (5 votes)');
    });

    it('formats CLOSED summary with winning option when votes cast', () => {
      const summary = formatPollClosureSummary(mockPoll, 'CLOSED');
      expect(summary).toContain('🔒 *Poll closed by its creator*');
      expect(summary).toContain('*3* total participants');
      expect(summary).toContain('Winner: *Thursday 2pm* (5 votes)');
    });

    it('formats CLOSED summary with 0 votes cast', () => {
      const emptyPoll = {
        question: 'Zero Vote Poll',
        options: [{ text: 'Opt 1', voteCount: 0 }],
        participations: [],
      };
      const summary = formatPollClosureSummary(emptyPoll, 'CLOSED');
      expect(summary).toContain('🔒 *Poll closed by its creator*');
      expect(summary).toContain('was closed with 0 votes cast.');
    });

    it('formats TIME_EXPIRED summary', () => {
      const summary = formatPollClosureSummary(mockPoll, 'TIME_EXPIRED');
      expect(summary).toContain('⏰ *Poll closed. Time expired*');
      expect(summary).toContain('Winner: *Thursday 2pm* (5 votes)');
    });

    it('formats tied outcome accurately when multiple options share top votes', () => {
      const tiedPoll = {
        question: 'Sprint Retro Date',
        options: [
          { text: 'Thursday 2pm', voteCount: 3 },
          { text: 'Friday 10am', voteCount: 3 },
          { text: 'Monday 9am', voteCount: 1 },
        ],
        participations: Array.from({ length: 7 }, (_, i) => ({ voterId: `U${i}` })),
      };
      const summary = formatPollClosureSummary(tiedPoll, 'QUORUM_REACHED');
      expect(summary).toContain(
        'Result: Tie between *Thursday 2pm*, *Friday 10am* (3 votes each).'
      );
    });
  });

  describe('vote_option_ action handler', () => {
    it('flushes UpdateQueue and posts thread summary when quorum is met', async () => {
      const poll = await PollService.createPoll({
        workspaceId,
        channelId: 'C_DEV_1',
        messageTs: '1700000000.000100',
        creatorId: 'U_LEAD',
        question: 'Release Today?',
        options: ['Yes', 'No'],
        quorumType: 'COUNT',
        quorumTarget: 1, // 1 vote reaches quorum
        eligibleVoterCount: 5,
      });

      const actionHandlers: Map<string | RegExp, Function> = new Map();
      const mockApp = {
        action: (pattern: any, handler: any) => actionHandlers.set(pattern, handler),
      } as any;

      registerActionHandlers(mockApp);

      let voteHandler: Function | undefined;
      for (const [pattern, handler] of actionHandlers.entries()) {
        if (pattern instanceof RegExp && pattern.test('vote_option_0')) {
          voteHandler = handler;
          break;
        }
      }
      expect(voteHandler).toBeDefined();

      const flushSpy = vi.spyOn(UpdateQueue, 'flushNow').mockResolvedValue(undefined as any);
      const postMessageSpy = vi.fn().mockResolvedValue({ ok: true });
      const postEphemeralSpy = vi.fn().mockResolvedValue({ ok: true });

      const mockClient = {
        chat: {
          postMessage: postMessageSpy,
          postEphemeral: postEphemeralSpy,
        },
      } as any;

      await voteHandler!({
        action: {
          value: JSON.stringify({
            pollId: poll.id,
            optionId: poll.options[0].id,
          }),
        },
        ack: vi.fn().mockResolvedValue(undefined),
        body: {
          user: { id: 'U_VOTER_1' },
          channel: { id: 'C_DEV_1' },
          message: { ts: '1700000000.000100' },
          team: { id: workspaceId },
        },
        client: mockClient,
      });

      expect(flushSpy).toHaveBeenCalledWith(
        poll.id,
        'C_DEV_1',
        '1700000000.000100',
        mockClient
      );
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C_DEV_1',
          thread_ts: '1700000000.000100',
          text: expect.stringContaining('🎉 *Quorum reached. Poll closed*'),
        })
      );
      expect(postEphemeralSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C_DEV_1',
          user: 'U_VOTER_1',
          text: expect.stringContaining('recorded'),
        })
      );

      flushSpy.mockRestore();
    });
  });

  describe('poll_close_click action handler', () => {
    it('closes the poll when clicked by creator, flushes update, and posts thread announcement', async () => {
      const poll = await PollService.createPoll({
        workspaceId,
        channelId: 'C_DEV_2',
        messageTs: '1700000000.000200',
        creatorId: 'U_CREATOR_ALICE',
        question: 'Manual Close Action Test',
        options: ['Accept', 'Reject'],
      });

      const actionHandlers: Map<string | RegExp, Function> = new Map();
      const mockApp = {
        action: (pattern: any, handler: any) => actionHandlers.set(pattern, handler),
      } as any;

      registerActionHandlers(mockApp);

      let closeHandler: Function | undefined;
      for (const [pattern, handler] of actionHandlers.entries()) {
        if (pattern instanceof RegExp && pattern.test('poll_close_click')) {
          closeHandler = handler;
          break;
        }
      }
      expect(closeHandler).toBeDefined();

      const flushSpy = vi.spyOn(UpdateQueue, 'flushNow').mockResolvedValue(undefined as any);
      const postMessageSpy = vi.fn().mockResolvedValue({ ok: true });

      const mockClient = {
        chat: {
          postMessage: postMessageSpy,
          postEphemeral: vi.fn(),
        },
      } as any;

      // Clicked by creator
      await closeHandler!({
        action: { value: JSON.stringify({ pollId: poll.id }) },
        ack: vi.fn().mockResolvedValue(undefined),
        body: {
          user: { id: 'U_CREATOR_ALICE' },
          channel: { id: 'C_DEV_2' },
          team: { id: workspaceId },
        },
        client: mockClient,
      });

      const updated = await prisma.poll.findUnique({ where: { id: poll.id } });
      expect(updated?.status).toBe('CLOSED');
      expect(flushSpy).toHaveBeenCalledWith(poll.id, 'C_DEV_2', '1700000000.000200', mockClient);
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C_DEV_2',
          thread_ts: '1700000000.000200',
          text: expect.stringContaining('🔒 *Poll closed by its creator*'),
        })
      );

      flushSpy.mockRestore();
    });

    it('rejects poll_close_click when clicked by a non-creator', async () => {
      const poll = await PollService.createPoll({
        workspaceId,
        channelId: 'C_DEV_2',
        messageTs: '1700000000.000201',
        creatorId: 'U_CREATOR_ALICE',
        question: 'Non-creator close test',
        options: ['Accept', 'Reject'],
      });

      const actionHandlers: Map<string | RegExp, Function> = new Map();
      const mockApp = {
        action: (pattern: any, handler: any) => actionHandlers.set(pattern, handler),
      } as any;

      registerActionHandlers(mockApp);

      let closeHandler: Function | undefined;
      for (const [pattern, handler] of actionHandlers.entries()) {
        if (pattern instanceof RegExp && pattern.test('poll_close_click')) {
          closeHandler = handler;
          break;
        }
      }

      const postEphemeralSpy = vi.fn().mockResolvedValue({ ok: true });
      const mockClient = {
        chat: {
          postMessage: vi.fn(),
          postEphemeral: postEphemeralSpy,
        },
      } as any;

      // Clicked by non-creator
      await closeHandler!({
        action: { value: JSON.stringify({ pollId: poll.id }) },
        ack: vi.fn().mockResolvedValue(undefined),
        body: {
          user: { id: 'U_INTRUDER_BOB' },
          channel: { id: 'C_DEV_2' },
          team: { id: workspaceId },
        },
        client: mockClient,
      });

      const updated = await prisma.poll.findUnique({ where: { id: poll.id } });
      expect(updated?.status).toBe('ACTIVE'); // Status must remain ACTIVE
      expect(postEphemeralSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C_DEV_2',
          user: 'U_INTRUDER_BOB',
          text: expect.stringContaining('Only the poll creator'),
        })
      );
    });
  });

  describe('poll_nudge_click action handler', () => {
    it('sends private DMs only to non-voters, logs to NudgeLog, and enforces 4h cooldown', async () => {
      const poll = await PollService.createPoll({
        workspaceId,
        channelId: 'C_DEV_3',
        messageTs: '1700000000.000300',
        creatorId: 'U_CREATOR_CAROL',
        question: 'Architecture RFC Approval',
        options: ['Approve', 'Needs Changes'],
        eligibleVoterCount: 4,
      });

      // Voter 1 casts vote
      await PollService.castVote({
        pollId: poll.id,
        voterId: 'U_VOTER_1',
        optionId: poll.options[0].id,
        workspaceSalt,
      });

      const actionHandlers: Map<string | RegExp, Function> = new Map();
      const mockApp = {
        action: (pattern: any, handler: any) => actionHandlers.set(pattern, handler),
      } as any;

      registerActionHandlers(mockApp);

      let nudgeHandler: Function | undefined;
      for (const [pattern, handler] of actionHandlers.entries()) {
        if (pattern instanceof RegExp && pattern.test('poll_nudge_click')) {
          nudgeHandler = handler;
          break;
        }
      }
      expect(nudgeHandler).toBeDefined();

      const postMessageSpy = vi.fn().mockResolvedValue({ ok: true });
      const postEphemeralSpy = vi.fn().mockResolvedValue({ ok: true });

      const mockClient = {
        auth: {
          test: vi.fn().mockResolvedValue({ user_id: 'B_BOT' }),
        },
        conversations: {
          members: vi.fn().mockResolvedValue({
            // Channel has: creator, voter 1, non-voter 2, non-voter 3, and bot
            members: [
              'U_CREATOR_CAROL',
              'U_VOTER_1',
              'U_NON_VOTER_2',
              'U_NON_VOTER_3',
              'B_BOT',
            ],
            response_metadata: {},
          }),
        },
        chat: {
          postMessage: postMessageSpy,
          postEphemeral: postEphemeralSpy,
        },
      } as any;

      // 1. Creator triggers Smart Nudge
      await nudgeHandler!({
        action: { value: JSON.stringify({ pollId: poll.id }) },
        ack: vi.fn().mockResolvedValue(undefined),
        body: {
          user: { id: 'U_CREATOR_CAROL' },
          channel: { id: 'C_DEV_3' },
          team: { id: workspaceId },
        },
        client: mockClient,
      });

      // Non-voters are U_CREATOR_CAROL (if hasn't voted), U_NON_VOTER_2, U_NON_VOTER_3.
      // Bot and U_VOTER_1 must NOT receive a nudge DM!
      const dmRecipients = postMessageSpy.mock.calls.map((call) => call[0].channel);
      expect(dmRecipients).not.toContain('B_BOT');
      expect(dmRecipients).not.toContain('U_VOTER_1');
      expect(dmRecipients).toContain('U_NON_VOTER_2');
      expect(dmRecipients).toContain('U_NON_VOTER_3');

      // Verify NudgeLog entries
      const logs = await prisma.nudgeLog.findMany({ where: { pollId: poll.id } });
      expect(logs.length).toBeGreaterThanOrEqual(2);
      expect(logs.some((l) => l.recipientId === 'U_NON_VOTER_2')).toBe(true);
      expect(logs.some((l) => l.recipientId === 'U_NON_VOTER_3')).toBe(true);

      // Verify creator gets private confirmation of count
      expect(postEphemeralSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C_DEV_3',
          user: 'U_CREATOR_CAROL',
          text: expect.stringContaining('Sent private reminders to'),
        })
      );

      // 2. Creator triggers Smart Nudge again immediately -> must be blocked by 4-hour cooldown
      postMessageSpy.mockClear();
      postEphemeralSpy.mockClear();

      await nudgeHandler!({
        action: { value: JSON.stringify({ pollId: poll.id }) },
        ack: vi.fn().mockResolvedValue(undefined),
        body: {
          user: { id: 'U_CREATOR_CAROL' },
          channel: { id: 'C_DEV_3' },
          team: { id: workspaceId },
        },
        client: mockClient,
      });

      expect(postMessageSpy).not.toHaveBeenCalled();
      expect(postEphemeralSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C_DEV_3',
          user: 'U_CREATOR_CAROL',
          text: expect.stringContaining('A reminder was already sent in the last 4 hours'),
        })
      );
    });

    it('blocks poll_nudge_click when channel has more than maxNudgeChannelMembers (default 50)', async () => {
      const poll = await PollService.createPoll({
        workspaceId,
        channelId: 'C_LARGE_CHANNEL',
        messageTs: '1700000000.000350',
        creatorId: 'U_CREATOR_CAROL',
        question: 'All-Hands Poll',
        options: ['Option A', 'Option B'],
        eligibleVoterCount: 65,
      });

      const actionHandlers: Map<string | RegExp, Function> = new Map();
      const mockApp = {
        action: (pattern: any, handler: any) => actionHandlers.set(pattern, handler),
      } as any;

      registerActionHandlers(mockApp);

      let nudgeHandler: Function | undefined;
      for (const [pattern, handler] of actionHandlers.entries()) {
        if (pattern instanceof RegExp && pattern.test('poll_nudge_click')) {
          nudgeHandler = handler;
          break;
        }
      }

      const postMessageSpy = vi.fn().mockResolvedValue({ ok: true });
      const postEphemeralSpy = vi.fn().mockResolvedValue({ ok: true });

      const sixtyMembers = Array.from({ length: 60 }, (_, i) => `U_MEM_${i + 1}`);
      const mockClient = {
        auth: {
          test: vi.fn().mockResolvedValue({ user_id: 'B_BOT' }),
        },
        conversations: {
          members: vi.fn().mockResolvedValue({
            members: sixtyMembers,
            response_metadata: {},
          }),
        },
        chat: {
          postMessage: postMessageSpy,
          postEphemeral: postEphemeralSpy,
        },
      } as any;

      await nudgeHandler!({
        action: { value: JSON.stringify({ pollId: poll.id }) },
        ack: vi.fn().mockResolvedValue(undefined),
        body: {
          user: { id: 'U_CREATOR_CAROL' },
          channel: { id: 'C_LARGE_CHANNEL' },
          team: { id: workspaceId },
        },
        client: mockClient,
      });

      expect(postMessageSpy).not.toHaveBeenCalled();
      expect(postEphemeralSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C_LARGE_CHANNEL',
          user: 'U_CREATOR_CAROL',
          text: expect.stringContaining(
            'Reminders are not available in channels with more than 50 members'
          ),
        })
      );
    });
  });

  describe('Command Handlers (/pollito close, nudge, huddle, and concurrency)', () => {
    it('executes /pollito close to manually close the latest active poll in channel', async () => {
      const poll = await PollService.createPoll({
        workspaceId,
        channelId: 'C_COMMAND_1',
        messageTs: '1700000000.000400',
        creatorId: 'U_COMMAND_USER',
        question: 'Command Close Test',
        options: ['A', 'B'],
      });

      const commandHandlers: Map<string, Function> = new Map();
      const mockApp = {
        command: (cmd: string, handler: Function) => commandHandlers.set(cmd, handler),
      } as any;

      registerCommandHandlers(mockApp);
      const handler = commandHandlers.get('/pollito');
      expect(handler).toBeDefined();

      const postEphemeralSpy = vi.fn().mockResolvedValue({ ok: true });
      const postMessageSpy = vi.fn().mockResolvedValue({ ok: true });
      const flushSpy = vi.spyOn(UpdateQueue, 'flushNow').mockResolvedValue(undefined as any);

      const mockClient = {
        chat: {
          postEphemeral: postEphemeralSpy,
          postMessage: postMessageSpy,
        },
      } as any;

      await handler!({
        command: {
          text: 'close',
          user_id: 'U_COMMAND_USER',
          channel_id: 'C_COMMAND_1',
          team_id: workspaceId,
        },
        ack: vi.fn().mockResolvedValue(undefined),
        client: mockClient,
      });

      const updated = await prisma.poll.findUnique({ where: { id: poll.id } });
      expect(updated?.status).toBe('CLOSED');
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C_COMMAND_1',
          thread_ts: '1700000000.000400',
          text: expect.stringContaining('🔒 *Poll closed by its creator*'),
        })
      );
      expect(postEphemeralSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C_COMMAND_1',
          user: 'U_COMMAND_USER',
          text: expect.stringContaining('Poll closed successfully'),
        })
      );

      flushSpy.mockRestore();
    });

    it('returns error when /pollito close is called with no active poll created by user', async () => {
      const commandHandlers: Map<string, Function> = new Map();
      const mockApp = {
        command: (cmd: string, handler: Function) => commandHandlers.set(cmd, handler),
      } as any;

      registerCommandHandlers(mockApp);
      const handler = commandHandlers.get('/pollito');

      const postEphemeralSpy = vi.fn().mockResolvedValue({ ok: true });
      const mockClient = {
        chat: {
          postEphemeral: postEphemeralSpy,
        },
      } as any;

      await handler!({
        command: {
          text: 'close',
          user_id: 'U_STRANGER',
          channel_id: 'C_EMPTY_CHANNEL',
          team_id: workspaceId,
        },
        ack: vi.fn().mockResolvedValue(undefined),
        client: mockClient,
      });

      expect(postEphemeralSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C_EMPTY_CHANNEL',
          user: 'U_STRANGER',
          text: expect.stringContaining('No active poll found in this channel that you created'),
        })
      );
    });

    it('returns quick help message when /pollito help is invoked', async () => {
      const commandHandlers: Map<string, Function> = new Map();
      const mockApp = {
        command: (cmd: string, handler: Function) => commandHandlers.set(cmd, handler),
      } as any;

      registerCommandHandlers(mockApp);
      const handler = commandHandlers.get('/pollito');

      const postEphemeralSpy = vi.fn().mockResolvedValue({ ok: true });
      const mockClient = {
        chat: {
          postEphemeral: postEphemeralSpy,
        },
      } as any;

      await handler!({
        command: {
          text: 'help',
          user_id: 'U_USER_HELP',
          channel_id: 'C_DEV_HELP',
          team_id: workspaceId,
        },
        ack: vi.fn().mockResolvedValue(undefined),
        client: mockClient,
      });

      expect(postEphemeralSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('/pollito close'),
        })
      );
      expect(postEphemeralSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('/pollito nudge'),
        })
      );
      expect(postEphemeralSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('/pollito huddle'),
        })
      );
    });

    it('enforces single active poll per channel unless allowMultipleActivePolls is enabled', async () => {
      await PollService.createPoll({
        workspaceId,
        channelId: 'C_SINGLE_ACTIVE',
        messageTs: '1700000000.000500',
        creatorId: 'U_CREATOR_1',
        question: 'First Active Poll',
        options: ['Yes', 'No'],
      });

      const commandHandlers: Map<string, Function> = new Map();
      const mockApp = {
        command: (cmd: string, handler: Function) => commandHandlers.set(cmd, handler),
      } as any;

      registerCommandHandlers(mockApp);
      const handler = commandHandlers.get('/pollito');

      const postEphemeralSpy = vi.fn().mockResolvedValue({ ok: true });
      const postMessageSpy = vi.fn().mockResolvedValue({ ok: true, ts: '1700000000.000501' });
      const updateSpy = vi.fn().mockResolvedValue({ ok: true });

      const mockClient = {
        auth: { test: vi.fn().mockResolvedValue({ user_id: 'B_BOT' }) },
        conversations: {
          join: vi.fn().mockResolvedValue({ ok: true }),
          members: vi.fn().mockResolvedValue({ members: ['U1', 'U2'], response_metadata: {} }),
        },
        chat: {
          postEphemeral: postEphemeralSpy,
          postMessage: postMessageSpy,
          update: updateSpy,
        },
      } as any;

      // 1. Attempt second poll while allowMultipleActivePolls is false (default)
      await handler!({
        command: {
          text: '"Second Poll?" "Opt 1" "Opt 2"',
          user_id: 'U_CREATOR_2',
          channel_id: 'C_SINGLE_ACTIVE',
          team_id: workspaceId,
        },
        ack: vi.fn().mockResolvedValue(undefined),
        client: mockClient,
      });

      expect(postMessageSpy).not.toHaveBeenCalled();
      expect(postEphemeralSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C_SINGLE_ACTIVE',
          user: 'U_CREATOR_2',
          text: expect.stringContaining('An active poll is already running in this channel'),
        })
      );

      // 2. Enable allowMultipleActivePolls -> second poll succeeds
      await PollService.updateWorkspaceSettings(workspaceId, {
        allowMultipleActivePolls: true,
      });

      await handler!({
        command: {
          text: '"Second Poll?" "Opt 1" "Opt 2"',
          user_id: 'U_CREATOR_2',
          channel_id: 'C_SINGLE_ACTIVE',
          team_id: workspaceId,
        },
        ack: vi.fn().mockResolvedValue(undefined),
        client: mockClient,
      });

      expect(postMessageSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy).toHaveBeenCalledTimes(1);
    });

    it('handles /pollito huddle by opening the Huddle modal even when no active Huddle is detected, and posts inline when quoted options are given', async () => {
      const commandHandlers: Map<string, Function> = new Map();
      const mockApp = {
        command: (cmd: string, handler: Function) => commandHandlers.set(cmd, handler),
      } as any;

      registerCommandHandlers(mockApp);
      const handler = commandHandlers.get('/pollito');

      const postEphemeralSpy = vi.fn().mockResolvedValue({ ok: true });
      const viewsOpenSpy = vi.fn().mockResolvedValue({ ok: true });
      const postMessageSpy = vi.fn().mockResolvedValue({ ok: true, ts: '1700000000.000602' });
      const updateSpy = vi.fn().mockResolvedValue({ ok: true });
      const historySpy = vi.fn();

      const mockClient = {
        auth: { test: vi.fn().mockResolvedValue({ user_id: 'B_BOT' }) },
        conversations: {
          history: historySpy,
          join: vi.fn().mockResolvedValue({ ok: true }),
          members: vi.fn().mockResolvedValue({ members: ['U1', 'U2'], response_metadata: {} }),
        },
        views: {
          open: viewsOpenSpy,
        },
        chat: {
          postEphemeral: postEphemeralSpy,
          postMessage: postMessageSpy,
          update: updateSpy,
        },
      } as any;

      // 1. No active Huddle thread in channel -> plain `/pollito huddle` still opens modal with huddleMode: true
      historySpy.mockResolvedValueOnce({
        messages: [{ ts: '1700000000.000100', text: 'Regular chat message' }],
      });

      await handler!({
        command: {
          text: 'huddle',
          user_id: 'U_HUDDLE_USER',
          channel_id: 'C_HUDDLE_CH',
          team_id: workspaceId,
          trigger_id: 'TRIG_1',
        },
        ack: vi.fn().mockResolvedValue(undefined),
        client: mockClient,
      });

      expect(viewsOpenSpy).toHaveBeenCalledTimes(1);
      const modalNoThread = viewsOpenSpy.mock.calls[0][0].view;
      expect(JSON.parse(modalNoThread.private_metadata)).toEqual({
        channelId: 'C_HUDDLE_CH',
        huddleMode: true,
      });

      // 2. Active Huddle thread exists -> plain `/pollito huddle` opens modal with threadTs in private_metadata
      viewsOpenSpy.mockClear();
      historySpy.mockResolvedValueOnce({
        messages: [
          {
            ts: '1700000000.000600',
            subtype: 'huddle_thread',
            text: 'A huddle started',
          },
        ],
      });

      await handler!({
        command: {
          text: 'huddle',
          user_id: 'U_HUDDLE_USER',
          channel_id: 'C_HUDDLE_CH',
          team_id: workspaceId,
          trigger_id: 'TRIG_2',
        },
        ack: vi.fn().mockResolvedValue(undefined),
        client: mockClient,
      });

      expect(viewsOpenSpy).toHaveBeenCalledTimes(1);
      const openedModal = viewsOpenSpy.mock.calls[0][0].view;
      const meta = JSON.parse(openedModal.private_metadata);
      expect(meta.channelId).toBe('C_HUDDLE_CH');
      expect(meta.threadTs).toBe('1700000000.000600');

      // 3. `/pollito huddle "Sprint Vote" "Yes" "No"` posts directly inside the Huddle thread
      historySpy.mockResolvedValueOnce({
        messages: [
          {
            ts: '1700000000.000600',
            subtype: 'huddle_thread',
            text: 'A huddle started',
          },
        ],
      });

      await handler!({
        command: {
          text: 'huddle "Sprint Vote" "Yes" "No"',
          user_id: 'U_HUDDLE_USER',
          channel_id: 'C_HUDDLE_CH',
          team_id: workspaceId,
          trigger_id: 'TRIG_3',
        },
        ack: vi.fn().mockResolvedValue(undefined),
        client: mockClient,
      });

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C_HUDDLE_CH',
          thread_ts: '1700000000.000600',
        })
      );

      const savedHuddlePoll = await prisma.poll.findFirst({
        where: { channelId: 'C_HUDDLE_CH', question: 'Sprint Vote' },
      });
      expect(savedHuddlePoll?.threadTs).toBe('1700000000.000600');
    });
  });

  describe('Role-scoped poll_view_results_click and open_analytics_modal', () => {
    it('allows poll creator and workspace manager to view detailed poll results, and blocks regular participants', async () => {
      const poll = await PollService.createPoll({
        workspaceId,
        channelId: 'C_RESULTS_CH',
        messageTs: '1700000000.000700',
        creatorId: 'U_POLL_OWNER',
        question: 'Architecture Vote',
        options: ['Option 1', 'Option 2'],
      });

      const actionHandlers: Map<string | RegExp, Function> = new Map();
      const mockApp = {
        action: (pattern: any, handler: any) => actionHandlers.set(pattern, handler),
      } as any;

      registerActionHandlers(mockApp);

      let resultsHandler: Function | undefined;
      for (const [pattern, handler] of actionHandlers.entries()) {
        if (pattern instanceof RegExp && pattern.test('poll_view_results_click')) {
          resultsHandler = handler;
          break;
        }
      }
      expect(resultsHandler).toBeDefined();

      const viewsOpenSpy = vi.fn().mockResolvedValue({ ok: true });
      const postEphemeralSpy = vi.fn().mockResolvedValue({ ok: true });

      const mockClient = {
        users: {
          info: vi.fn().mockResolvedValue({
            user: { id: 'U_REGULAR_VOTER', is_admin: false, is_owner: false },
          }),
        },
        views: {
          open: viewsOpenSpy,
        },
        chat: {
          postEphemeral: postEphemeralSpy,
          postMessage: vi.fn().mockResolvedValue({ ok: true }),
        },
      } as any;

      // 1. Regular non-creator user is blocked
      await resultsHandler!({
        action: { value: JSON.stringify({ pollId: poll.id }) },
        ack: vi.fn().mockResolvedValue(undefined),
        body: {
          user: { id: 'U_REGULAR_VOTER' },
          channel: { id: 'C_RESULTS_CH' },
          team: { id: workspaceId },
          trigger_id: 'TRIG_REG',
        },
        client: mockClient,
      });

      expect(viewsOpenSpy).not.toHaveBeenCalled();
      expect(postEphemeralSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          user: 'U_REGULAR_VOTER',
          text: expect.stringContaining(
            'Only the poll creator or a workspace admin can view detailed results'
          ),
        })
      );

      // 2. Poll creator is allowed
      await resultsHandler!({
        action: { value: JSON.stringify({ pollId: poll.id }) },
        ack: vi.fn().mockResolvedValue(undefined),
        body: {
          user: { id: 'U_POLL_OWNER' },
          channel: { id: 'C_RESULTS_CH' },
          team: { id: workspaceId },
          trigger_id: 'TRIG_OWNER',
        },
        client: mockClient,
      });

      expect(viewsOpenSpy).toHaveBeenCalledTimes(1);

      // 3. Workspace manager (via managerUserIds) is allowed
      await PollService.updateWorkspaceSettings(workspaceId, {
        managerUserIds: ['U_DESIGNATED_MANAGER'],
      });

      await resultsHandler!({
        action: { value: JSON.stringify({ pollId: poll.id }) },
        ack: vi.fn().mockResolvedValue(undefined),
        body: {
          user: { id: 'U_DESIGNATED_MANAGER' },
          channel: { id: 'C_RESULTS_CH' },
          team: { id: workspaceId },
          trigger_id: 'TRIG_MGR',
        },
        client: mockClient,
      });

      expect(viewsOpenSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Modal Submission Validation (Zod & Views)', () => {
    it('validates schema correctly, rejects quorumTarget=50, and accepts quorumTarget=51', () => {
      // Valid input (70%)
      const valid = createPollSubmissionSchema.safeParse({
        selectedChannel: 'C123',
        question: 'What is your favorite color?',
        opt1: 'Blue',
        opt2: 'Green',
        quorumTarget: 70,
      });
      expect(valid.success).toBe(true);

      // 50% is NEVER quorum -> must fail validation
      const fiftyPercent = createPollSubmissionSchema.safeParse({
        selectedChannel: 'C123',
        question: 'Is 50% a quorum?',
        opt1: 'Yes',
        opt2: 'No',
        quorumTarget: 50,
      });
      expect(fiftyPercent.success).toBe(false);

      // 51% strict majority -> must pass validation
      const fiftyOnePercent = createPollSubmissionSchema.safeParse({
        selectedChannel: 'C123',
        question: 'Is 51% a quorum?',
        opt1: 'Yes',
        opt2: 'No',
        quorumTarget: 51,
      });
      expect(fiftyOnePercent.success).toBe(true);

      // Question over 150 chars
      const tooLongQuestion = createPollSubmissionSchema.safeParse({
        selectedChannel: 'C123',
        question: 'A'.repeat(151),
        opt1: 'Blue',
        opt2: 'Green',
        quorumTarget: 70,
      });
      expect(tooLongQuestion.success).toBe(false);

      // Missing options
      const missingOpt = createPollSubmissionSchema.safeParse({
        selectedChannel: 'C123',
        question: 'Valid question',
        opt1: '',
        opt2: 'Green',
        quorumTarget: 70,
      });
      expect(missingOpt.success).toBe(false);

      // Quorum out of range
      const invalidQuorum = createPollSubmissionSchema.safeParse({
        selectedChannel: 'C123',
        question: 'Valid question',
        opt1: 'A',
        opt2: 'B',
        quorumTarget: 105,
      });
      expect(invalidQuorum.success).toBe(false);
    });

    it('rejects modal submission with response_action errors when inputs fail Zod validation', async () => {
      const viewHandlers: Map<string, Function> = new Map();
      const mockApp = {
        view: (id: string, handler: Function) => viewHandlers.set(id, handler),
      } as any;

      registerViewHandlers(mockApp);
      const handler = viewHandlers.get('create_poll_modal_submit');
      expect(handler).toBeDefined();

      const ackSpy = vi.fn().mockResolvedValue(undefined);

      await handler!({
        ack: ackSpy,
        view: {
          state: {
            values: {
              channel_block: { channel_select: { selected_conversation: '' } },
              question_block: { question_input: { value: '' } },
              option_1_block: { option_1_input: { value: '' } },
              option_2_block: { option_2_input: { value: '' } },
              quorum_block: { quorum_input: { value: '999' } },
            },
          },
          private_metadata: '',
        },
        body: { user: { id: 'U_TESTER' } },
        client: {} as any,
      });

      expect(ackSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          response_action: 'errors',
          errors: expect.objectContaining({
            channel_block: expect.any(String),
            question_block: expect.any(String),
            option_1_block: expect.any(String),
            option_2_block: expect.any(String),
            quorum_block: expect.any(String),
          }),
        })
      );
    });

    it('rejects create_poll_modal_submit with channel_block error when an active poll already exists in the channel', async () => {
      await PollService.createPoll({
        workspaceId,
        channelId: 'C_MODAL_CONCURRENCY',
        messageTs: '1700000000.000800',
        creatorId: 'U_EXISTING',
        question: 'Existing Poll',
        options: ['Yes', 'No'],
      });

      const viewHandlers: Map<string, Function> = new Map();
      const mockApp = {
        view: (id: string, handler: Function) => viewHandlers.set(id, handler),
      } as any;

      registerViewHandlers(mockApp);
      const handler = viewHandlers.get('create_poll_modal_submit');

      const ackSpy = vi.fn().mockResolvedValue(undefined);

      await handler!({
        ack: ackSpy,
        view: {
          state: {
            values: {
              channel_block: {
                channel_select: { selected_conversation: 'C_MODAL_CONCURRENCY' },
              },
              question_block: { question_input: { value: 'Second Poll' } },
              option_1_block: { option_1_input: { value: 'Yes' } },
              option_2_block: { option_2_input: { value: 'No' } },
              quorum_block: { quorum_input: { value: '70' } },
            },
          },
          private_metadata: '',
        },
        body: { user: { id: 'U_TESTER' }, team: { id: workspaceId } },
        client: {} as any,
      });

      expect(ackSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          response_action: 'errors',
          errors: expect.objectContaining({
            channel_block: expect.stringContaining('An active poll is already running in this channel'),
          }),
        })
      );
    });

    it('deletes selected polls from database without deleting Slack channel message cards', async () => {
      const poll1 = await PollService.createPoll({
        workspaceId,
        channelId: 'C_BULK_DEL_1',
        messageTs: '1700000000.000910',
        creatorId: 'U_CREATOR_BULK',
        question: 'Bulk Delete Poll 1',
        options: ['Yes', 'No'],
      });
      const poll2 = await PollService.createPoll({
        workspaceId,
        channelId: 'C_BULK_DEL_2',
        messageTs: '1700000000.000911',
        creatorId: 'U_CREATOR_BULK',
        question: 'Bulk Delete Poll 2',
        options: ['A', 'B'],
      });

      const viewHandlers: Map<string, Function> = new Map();
      const mockApp = {
        view: (id: string, handler: Function) => viewHandlers.set(id, handler),
      } as any;

      registerViewHandlers(mockApp);
      const handler =
        viewHandlers.get('delete_polls_modal') ??
        viewHandlers.get('manage_history_modal_submit');
      expect(handler).toBeDefined();

      const deleteSpy = vi.fn().mockResolvedValue({ ok: true });
      const publishSpy = vi.fn().mockResolvedValue({ ok: true });
      const mockClient = {
        chat: {
          delete: deleteSpy,
          postEphemeral: vi.fn(),
          postMessage: vi.fn(),
        },
        views: {
          publish: publishSpy,
        },
        users: {
          info: vi.fn().mockResolvedValue({ user: { locale: 'en-US' } }),
        },
      } as any;

      const ackSpy = vi.fn().mockResolvedValue(undefined);

      await handler!({
        ack: ackSpy,
        view: {
          state: {
            values: {
              delete_polls_select_block: {
                delete_polls_multi_select: {
                  selected_options: [{ value: poll1.id }, { value: poll2.id }],
                },
              },
            },
          },
        },
        body: {
          user: { id: 'U_CREATOR_BULK' },
          team: { id: workspaceId },
        },
        client: mockClient,
      });

      expect(ackSpy).toHaveBeenCalled();
      const foundP1 = await prisma.poll.findUnique({ where: { id: poll1.id } });
      const foundP2 = await prisma.poll.findUnique({ where: { id: poll2.id } });
      expect(foundP1).toBeNull();
      expect(foundP2).toBeNull();
      expect(deleteSpy).not.toHaveBeenCalled();
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'U_CREATOR_BULK' })
      );
    });
  });

  describe('App Home Poll Deletion & Cleanup (Channel Card Preservation)', () => {
    it('deletes poll from database upon poll_delete_click without deleting Slack channel message card', async () => {
      const poll = await PollService.createPoll({
        workspaceId,
        channelId: 'C_HOME_DEL',
        messageTs: '1700000000.000920',
        creatorId: 'U_CREATOR_DEL',
        question: 'Preserve Channel Card On Delete Test',
        options: ['Option A', 'Option B'],
      });

      const actionHandlers: Map<string | RegExp, Function> = new Map();
      const mockApp = {
        action: (pattern: any, handler: any) => actionHandlers.set(pattern, handler),
      } as any;

      registerActionHandlers(mockApp);

      let deleteHandler: Function | undefined;
      for (const [pattern, handler] of actionHandlers.entries()) {
        if (pattern instanceof RegExp && pattern.test('poll_delete_click')) {
          deleteHandler = handler;
          break;
        }
      }
      expect(deleteHandler).toBeDefined();

      const deleteSpy = vi.fn().mockResolvedValue({ ok: true });
      const publishSpy = vi.fn().mockResolvedValue({ ok: true });
      const mockClient = {
        chat: {
          delete: deleteSpy,
          postEphemeral: vi.fn(),
          postMessage: vi.fn(),
        },
        views: {
          publish: publishSpy,
        },
        users: {
          info: vi.fn().mockResolvedValue({ user: { locale: 'en-US' } }),
        },
      } as any;

      await deleteHandler!({
        action: { value: JSON.stringify({ pollId: poll.id }) },
        ack: vi.fn().mockResolvedValue(undefined),
        body: {
          user: { id: 'U_CREATOR_DEL' },
          team: { id: workspaceId },
        },
        client: mockClient,
      });

      const deletedRecord = await prisma.poll.findUnique({ where: { id: poll.id } });
      expect(deletedRecord).toBeNull();
      expect(deleteSpy).not.toHaveBeenCalled();
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'U_CREATOR_DEL' })
      );
    });

    it('clears closed polls from database upon app_home_clear_closed_click without deleting Slack channel message cards', async () => {
      const closedPoll1 = await PollService.createPoll({
        workspaceId,
        channelId: 'C_CLEAR_1',
        messageTs: '1700000000.000930',
        creatorId: 'U_CREATOR_CLEAR',
        question: 'Closed Poll 1',
        options: ['Opt 1', 'Opt 2'],
      });
      await PollService.closePoll(closedPoll1.id, 'U_CREATOR_CLEAR', 'CLOSED');

      const closedPoll2 = await PollService.createPoll({
        workspaceId,
        channelId: 'C_CLEAR_2',
        messageTs: '1700000000.000931',
        creatorId: 'U_CREATOR_CLEAR',
        question: 'Closed Poll 2',
        options: ['Opt 1', 'Opt 2'],
      });
      await PollService.closePoll(closedPoll2.id, 'U_CREATOR_CLEAR', 'CLOSED');

      const activePoll = await PollService.createPoll({
        workspaceId,
        channelId: 'C_CLEAR_3',
        messageTs: '1700000000.000932',
        creatorId: 'U_CREATOR_CLEAR',
        question: 'Active Poll Preserved',
        options: ['Opt 1', 'Opt 2'],
      });

      const actionHandlers: Map<string | RegExp, Function> = new Map();
      const mockApp = {
        action: (pattern: any, handler: any) => actionHandlers.set(pattern, handler),
      } as any;

      registerActionHandlers(mockApp);

      const clearHandler = actionHandlers.get('app_home_clear_closed_click');
      expect(clearHandler).toBeDefined();

      const deleteSpy = vi.fn().mockResolvedValue({ ok: true });
      const publishSpy = vi.fn().mockResolvedValue({ ok: true });
      const mockClient = {
        chat: {
          delete: deleteSpy,
          postEphemeral: vi.fn(),
          postMessage: vi.fn(),
        },
        views: {
          publish: publishSpy,
        },
        users: {
          info: vi.fn().mockResolvedValue({ user: { locale: 'en-US' } }),
        },
      } as any;

      await clearHandler!({
        ack: vi.fn().mockResolvedValue(undefined),
        body: {
          user: { id: 'U_CREATOR_CLEAR' },
          team: { id: workspaceId },
        },
        client: mockClient,
      });

      const p1 = await prisma.poll.findUnique({ where: { id: closedPoll1.id } });
      const p2 = await prisma.poll.findUnique({ where: { id: closedPoll2.id } });
      const active = await prisma.poll.findUnique({ where: { id: activePoll.id } });

      expect(p1).toBeNull();
      expect(p2).toBeNull();
      expect(active).not.toBeNull();
      expect(deleteSpy).not.toHaveBeenCalled();
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'U_CREATOR_CLEAR' })
      );
    });
  });

  describe('publishHomeTab & Multi-Tenant Token Resolution', () => {
    it('passes resolved workspace bot token to client.views.publish for third-party workspaces', async () => {
      const publishSpy = vi.fn().mockResolvedValue({ ok: true });
      const mockClient = {
        views: {
          publish: publishSpy,
        },
        users: {
          info: vi.fn().mockResolvedValue({ user: { locale: 'en-US' } }),
        },
      };

      await publishHomeTab(mockClient, 'U_THIRD_PARTY_USER', workspaceId);

      expect(publishSpy).toHaveBeenCalledTimes(1);
      const callArgs = publishSpy.mock.calls[0][0];
      expect(callArgs.user_id).toBe('U_THIRD_PARTY_USER');
      expect(callArgs.token).toBeDefined();
      expect(typeof callArgs.token).toBe('string');
      expect(callArgs.view).toBeDefined();
      expect(callArgs.view.type).toBe('home');
    });
  });
});

