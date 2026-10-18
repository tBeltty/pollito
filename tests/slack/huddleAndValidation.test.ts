import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '../../src/db/prisma.js';
import {
  findChannelHuddles,
  findActiveHuddleThread,
  parseHuddleThreadInput,
  notifyMainChannelOnHuddleEnd,
} from '../../src/slack/utils/huddleDiscovery.js';
import { PollService } from '../../src/services/pollService.js';
import { registerCommandHandlers } from '../../src/slack/handlers/commands.js';
import { registerViewHandlers } from '../../src/slack/handlers/views.js';

describe('Huddle Thread Discovery, Permalink Parsing & Modal Flow', () => {
  const workspaceId = 'T_HUDDLE_PARITY_TEST';
  const workspaceSalt = 'test_salt_huddle_parity_12345';
  const originalDiscoveryToken = process.env.SLACK_HUDDLE_DISCOVERY_TOKEN;

  beforeEach(async () => {
    delete process.env.SLACK_HUDDLE_DISCOVERY_TOKEN;

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
        teamName: 'Huddle Parity Test Team',
        botToken: ['xoxb', 'mock', 'huddle', 'token'].join('-'),
        settings: {
          create: {
            anonymousSalt: workspaceSalt,
          },
        },
      },
    });
  });

  afterEach(() => {
    if (originalDiscoveryToken === undefined) {
      delete process.env.SLACK_HUDDLE_DISCOVERY_TOKEN;
    } else {
      process.env.SLACK_HUDDLE_DISCOVERY_TOKEN = originalDiscoveryToken;
    }
  });

  describe('parseHuddleThreadInput', () => {
    it('parses Slack message permalinks and raw timestamps accurately', () => {
      expect(
        parseHuddleThreadInput(
          'https://workspace.slack.com/archives/C12345678/p1700000000000100'
        )
      ).toBe('1700000000.000100');

      expect(parseHuddleThreadInput('  1700000000.000100  ')).toBe(
        '1700000000.000100'
      );

      expect(parseHuddleThreadInput('')).toBeNull();
      expect(parseHuddleThreadInput('not-a-timestamp')).toBeNull();
    });
  });

  describe('findChannelHuddles & findActiveHuddleThread', () => {
    it('falls back to SLACK_HUDDLE_DISCOVERY_TOKEN when primary token returns missing_scope', async () => {
      process.env.SLACK_HUDDLE_DISCOVERY_TOKEN = ['xoxb', 'fallback', 'token'].join('-');

      const historySpy = vi
        .fn()
        .mockRejectedValueOnce({ data: { error: 'missing_scope' } })
        .mockResolvedValueOnce({
          messages: [
            {
              ts: '1700000000.000777',
              subtype: 'huddle_thread',
              text: 'A huddle started',
            },
          ],
        });

      const joinSpy = vi.fn().mockResolvedValue({ ok: true });
      const mockClient = {
        conversations: {
          join: joinSpy,
          history: historySpy,
        },
      } as any;

      const huddles = await findChannelHuddles(
        mockClient,
        'C_FALLBACK_CH',
        ['xoxb', 'primary', 'token'].join('-')
      );

      expect(historySpy).toHaveBeenCalledTimes(2);
      expect(historySpy).toHaveBeenNthCalledWith(2, {
        channel: 'C_FALLBACK_CH',
        limit: 50,
        token: ['xoxb', 'fallback', 'token'].join('-'),
      });
      expect(huddles).toHaveLength(1);
      expect(huddles[0].ts).toBe('1700000000.000777');
      expect(huddles[0].isActive).toBe(true);
    });

    it('returns [] without throwing when conversations.history fails and no fallback token is set', async () => {
      const mockClient = {
        conversations: {
          join: vi.fn().mockResolvedValue({ ok: true }),
          history: vi.fn().mockRejectedValue({ data: { error: 'missing_scope' } }),
        },
      } as any;

      await expect(
        findChannelHuddles(mockClient, 'C_NO_SCOPE_CH')
      ).resolves.toEqual([]);
      await expect(
        findActiveHuddleThread(mockClient, 'C_NO_SCOPE_CH')
      ).resolves.toBeNull();
    });
  });

  describe('/pollito huddle modal & permalink submission flow', () => {
    it('opens the Huddle Poll modal even when findActiveHuddleThread returns null, and submits with a pasted Slack Huddle permalink in huddle_thread_block', async () => {
      const commandHandlers: Map<string, Function> = new Map();
      const viewHandlers: Map<string, Function> = new Map();
      const mockApp = {
        command: (cmd: string, handler: Function) => commandHandlers.set(cmd, handler),
        view: (id: string, handler: Function) => viewHandlers.set(id, handler),
      } as any;

      registerCommandHandlers(mockApp);
      registerViewHandlers(mockApp);

      const cmdHandler = commandHandlers.get('/pollito')!;
      const viewHandler = viewHandlers.get('create_poll_modal_submit')!;

      const viewsOpenSpy = vi.fn().mockResolvedValue({ ok: true });
      const postMessageSpy = vi
        .fn()
        .mockResolvedValue({ ok: true, ts: '1700000000.000999' });
      const updateSpy = vi.fn().mockResolvedValue({ ok: true });

      const mockClient = {
        auth: { test: vi.fn().mockResolvedValue({ user_id: 'B_BOT' }) },
        conversations: {
          join: vi.fn().mockResolvedValue({ ok: true }),
          history: vi.fn().mockRejectedValue({ data: { error: 'missing_scope' } }),
          members: vi
            .fn()
            .mockResolvedValue({ members: ['U1', 'U2'], response_metadata: {} }),
        },
        views: {
          open: viewsOpenSpy,
        },
        chat: {
          postEphemeral: vi.fn().mockResolvedValue({ ok: true }),
          postMessage: postMessageSpy,
          update: updateSpy,
        },
      } as any;

      // 1. Run `/pollito huddle` when history throws missing_scope (so findActiveHuddleThread returns null)
      await cmdHandler({
        command: {
          text: 'huddle',
          user_id: 'U_HUDDLE_CREATOR',
          channel_id: 'C_HUDDLE_MODAL_CH',
          team_id: workspaceId,
          trigger_id: 'TRIG_MODAL_1',
        },
        ack: vi.fn().mockResolvedValue(undefined),
        client: mockClient,
      });

      expect(viewsOpenSpy).toHaveBeenCalledTimes(1);
      const modalView = viewsOpenSpy.mock.calls[0][0].view;
      expect(modalView.title.text).toBe('Create a Huddle Poll');

      const huddleThreadBlock = modalView.blocks.find(
        (b: any) => b.block_id === 'huddle_thread_block'
      );
      expect(huddleThreadBlock).toBeDefined();
      expect(huddleThreadBlock.optional).toBe(true);

      // 2. Submit modal with a pasted Slack Huddle permalink in huddle_thread_block
      const ackSpy = vi.fn().mockResolvedValue(undefined);
      await viewHandler({
        ack: ackSpy,
        view: {
          private_metadata: modalView.private_metadata,
          state: {
            values: {
              channel_block: {
                channel_select: { selected_conversation: 'C_HUDDLE_MODAL_CH' },
              },
              huddle_thread_block: {
                huddle_thread_input: {
                  value:
                    'https://workspace.slack.com/archives/C_HUDDLE_MODAL_CH/p1700000000123456',
                },
              },
              question_block: {
                question_input: { value: 'Ship the Huddle feature?' },
              },
              option_1_block: { option_1_input: { value: 'Yes' } },
              option_2_block: { option_2_input: { value: 'No' } },
              quorum_block: { quorum_input: { value: '70' } },
            },
          },
        },
        body: { user: { id: 'U_HUDDLE_CREATOR' }, team: { id: workspaceId } },
        client: mockClient,
      });

      expect(ackSpy).toHaveBeenCalledWith();
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C_HUDDLE_MODAL_CH',
          thread_ts: '1700000000.123456',
        })
      );

      const createdPoll = await prisma.poll.findFirst({
        where: {
          channelId: 'C_HUDDLE_MODAL_CH',
          question: 'Ship the Huddle feature?',
        },
      });
      expect(createdPoll?.threadTs).toBe('1700000000.123456');
    });
  });

  describe('Huddle End Notification Flow', () => {
    it('posts a "Remember to vote" reminder to the main channel when Huddle ends with an active poll', async () => {
      const poll = await PollService.createPoll({
        workspaceId,
        channelId: 'C_REMINDER_TEST_CH',
        messageTs: '1700000000.003001',
        threadTs: '1700000000.003000',
        creatorId: 'U_LEAD',
        question: 'Sprint retrospective feedback',
        options: ['Great', 'Needs work'],
        forwardToChannelOnHuddleEnd: true,
      });

      const postMessageSpy = vi.fn().mockResolvedValue({ ok: true });
      const getPermalinkSpy = vi.fn().mockResolvedValue({
        ok: true,
        permalink:
          'https://workspace.slack.com/archives/C_REMINDER_TEST_CH/p1700000000003001?thread_ts=1700000000.003000',
      });

      const mockClient = {
        chat: {
          postMessage: postMessageSpy,
          getPermalink: getPermalinkSpy,
        },
      } as any;

      const sent = await notifyMainChannelOnHuddleEnd(mockClient, poll);
      expect(sent).toBe(true);

      expect(postMessageSpy).toHaveBeenCalledTimes(1);
      const postArgs = postMessageSpy.mock.calls[0][0];
      expect(postArgs.channel).toBe('C_REMINDER_TEST_CH');
      expect(postArgs.text).toContain('Remember to vote');
      expect(postArgs.text).toContain('Sprint retrospective feedback');
      expect(postArgs.unfurl_links).toBe(true);

      // Verify the reminder cannot be sent twice (claim prevents duplicates)
      const secondAttempt = await notifyMainChannelOnHuddleEnd(mockClient, poll);
      expect(secondAttempt).toBe(false);
      expect(postMessageSpy).toHaveBeenCalledTimes(1);
    });
  });
});

