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
      expect(summary).toContain('🎉 *Quorum Reached — Poll Closed*');
      expect(summary).toContain('*Sprint Retro Date*');
      expect(summary).toContain('*3* participants');
      expect(summary).toContain('Leading choice: *Thursday 2pm* (5 votes)');
    });

    it('formats CLOSED summary with winning option when votes cast', () => {
      const summary = formatPollClosureSummary(mockPoll, 'CLOSED');
      expect(summary).toContain('🔒 *Poll Closed by Creator*');
      expect(summary).toContain('*3* total participants');
      expect(summary).toContain('Leading choice: *Thursday 2pm* (5 votes)');
    });

    it('formats CLOSED summary with 0 votes cast', () => {
      const emptyPoll = {
        question: 'Zero Vote Poll',
        options: [{ text: 'Opt 1', voteCount: 0 }],
        participations: [],
      };
      const summary = formatPollClosureSummary(emptyPoll, 'CLOSED');
      expect(summary).toContain('🔒 *Poll Closed by Creator*');
      expect(summary).toContain('was closed with 0 votes cast.');
    });

    it('formats TIME_EXPIRED summary', () => {
      const summary = formatPollClosureSummary(mockPoll, 'TIME_EXPIRED');
      expect(summary).toContain('⏰ *Poll Closed — Time Expired*');
      expect(summary).toContain('Leading choice: *Thursday 2pm* (5 votes)');
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
          text: expect.stringContaining('🎉 *Quorum Reached — Poll Closed*'),
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
          text: expect.stringContaining('🔒 *Poll Closed by Creator*'),
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
          text: expect.stringContaining('Only the poll creator can manually close this poll'),
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
          text: expect.stringContaining('A reminder was already sent within the last 4 hours'),
        })
      );
    });
  });

  describe('Command Handlers (/pollito close and /pollito nudge)', () => {
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
          text: expect.stringContaining('🔒 *Poll Closed by Creator*'),
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
    });
  });

  describe('Modal Submission Validation (Zod & Views)', () => {
    it('validates schema correctly and rejects invalid submissions with field-specific errors', () => {
      // Valid input
      const valid = createPollSubmissionSchema.safeParse({
        selectedChannel: 'C123',
        question: 'What is your favorite color?',
        opt1: 'Blue',
        opt2: 'Green',
        quorumTarget: 70,
      });
      expect(valid.success).toBe(true);

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
  });
});
