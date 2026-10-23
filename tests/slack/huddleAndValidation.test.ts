import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '../../src/db/prisma.js';
import {
  findChannelHuddles,
  findActiveHuddleThread,
  parseHuddleThreadInput,
  notifyMainChannelOnHuddleEnd,
  clearCachedActiveHuddles,
} from '../../src/slack/utils/huddleDiscovery.js';
import { PollService } from '../../src/services/pollService.js';
import { registerCommandHandlers } from '../../src/slack/handlers/commands.js';
import { registerActionHandlers } from '../../src/slack/handlers/actions.js';
import {
  registerEventHandlers,
  clearGreetedHuddleThreads,
} from '../../src/slack/handlers/events.js';
import { registerViewHandlers } from '../../src/slack/handlers/views.js';

describe('Huddle Thread Discovery, Permalink Parsing & Modal Flow', () => {
  const workspaceId = 'T_HUDDLE_PARITY_TEST';
  const workspaceSalt = 'test_salt_huddle_parity_12345';
  const originalDiscoveryToken = process.env.SLACK_HUDDLE_DISCOVERY_TOKEN;

  beforeEach(async () => {
    delete process.env.SLACK_HUDDLE_DISCOVERY_TOKEN;
    clearCachedActiveHuddles();
    clearGreetedHuddleThreads();

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
      expect(modalView.title.text).toBe('Create a Huddle poll');

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
    it('posts a vote reminder to the main channel when Huddle ends with an active poll', async () => {
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
      expect(postArgs.text).toContain('The Huddle ended');
      expect(postArgs.text).toContain('Sprint retrospective feedback');
      expect(postArgs.unfurl_links).toBe(true);

      // Verify the reminder cannot be sent twice (claim prevents duplicates)
      const secondAttempt = await notifyMainChannelOnHuddleEnd(mockClient, poll);
      expect(secondAttempt).toBe(false);
      expect(postMessageSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Plain /pollito Auto-Detection, Standby Card, In-Thread Triggers & Shortcuts', () => {
    it('auto-detects an active Huddle thread when running plain /pollito and opens the modal pre-bound to that threadTs', async () => {
      const commandHandlers: Map<string, Function> = new Map();
      const mockApp = {
        command: (cmd: string, handler: Function) => commandHandlers.set(cmd, handler),
      } as any;

      registerCommandHandlers(mockApp);
      const cmdHandler = commandHandlers.get('/pollito')!;

      const viewsOpenSpy = vi.fn().mockResolvedValue({ ok: true });
      const mockClient = {
        conversations: {
          join: vi.fn().mockResolvedValue({ ok: true }),
          history: vi.fn().mockResolvedValue({
            messages: [
              {
                ts: '1700000000.005555',
                subtype: 'huddle_thread',
                text: 'A huddle started',
              },
            ],
          }),
        },
        views: {
          open: viewsOpenSpy,
        },
      } as any;

      await cmdHandler({
        command: {
          text: '',
          user_id: 'U_PLAIN_CMD',
          channel_id: 'C_ACTIVE_HUDDLE_CH',
          team_id: workspaceId,
          trigger_id: 'TRIG_PLAIN_1',
        },
        ack: vi.fn().mockResolvedValue(undefined),
        client: mockClient,
      });

      expect(viewsOpenSpy).toHaveBeenCalledTimes(1);
      const modalView = viewsOpenSpy.mock.calls[0][0].view;
      const meta = JSON.parse(modalView.private_metadata);
      expect(meta.channelId).toBe('C_ACTIVE_HUDDLE_CH');
      expect(meta.threadTs).toBe('1700000000.005555');
      expect(meta.huddleMode).toBe(true);
    });

    it('stays quiet by default on Huddle start, and only posts standby card when autoPromptHuddlePoll is enabled', async () => {
      const eventHandlers: Map<string, Function> = new Map();
      const actionHandlers: Map<string | RegExp, Function> = new Map();
      const mockApp = {
        event: (name: string, handler: Function) => eventHandlers.set(name, handler),
        action: (pattern: any, handler: Function) => actionHandlers.set(pattern, handler),
      } as any;

      registerEventHandlers(mockApp);
      registerActionHandlers(mockApp);

      const messageHandler = eventHandlers.get('message')!;
      const standbyActionHandler = actionHandlers.get('open_huddle_poll_modal_action')!;
      expect(messageHandler).toBeDefined();
      expect(standbyActionHandler).toBeDefined();

      const postMessageSpy = vi.fn().mockResolvedValue({ ok: true });
      const viewsOpenSpy = vi.fn().mockResolvedValue({ ok: true });
      const mockClient = {
        chat: {
          postMessage: postMessageSpy,
        },
        views: {
          open: viewsOpenSpy,
        },
      } as any;

      // 1. By default (autoPromptHuddlePoll is false), Huddle starts in C_STANDBY_CH without unsolicited messages
      await messageHandler({
        event: {
          channel: 'C_STANDBY_CH',
          ts: '1700000000.006666',
          subtype: 'huddle_thread',
          text: 'A huddle started',
        },
        body: { team_id: workspaceId },
        client: mockClient,
      });

      expect(postMessageSpy).not.toHaveBeenCalled();

      // Clear greeted cache so second huddle can trigger after enabling setting
      clearGreetedHuddleThreads();

      // 2. Enable autoPromptHuddlePoll in workspace settings
      await PollService.updateWorkspaceSettings(workspaceId, {
        autoPromptHuddlePoll: true,
      });

      // 3. Second Huddle starts with autoPromptHuddlePoll enabled -> standby card is posted
      await messageHandler({
        event: {
          channel: 'C_STANDBY_CH',
          ts: '1700000000.007777',
          subtype: 'huddle_thread',
          text: 'A huddle started',
        },
        body: { team_id: workspaceId },
        client: mockClient,
      });

      expect(postMessageSpy).toHaveBeenCalledTimes(1);
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C_STANDBY_CH',
          thread_ts: '1700000000.007777',
        })
      );

      const standbyBlocks = postMessageSpy.mock.calls[0][0].blocks;
      expect(standbyBlocks[0].accessory.action_id).toBe('open_huddle_poll_modal_action');
      const buttonValue = standbyBlocks[0].accessory.value;

      // 4. Clicking the standby button opens the modal locked to C_STANDBY_CH and 1700000000.007777
      await standbyActionHandler({
        action: { value: buttonValue },
        ack: vi.fn().mockResolvedValue(undefined),
        body: {
          trigger_id: 'TRIG_STANDBY_BTN',
          user: { id: 'U_HUDDLE_CLICKER' },
          team: { id: workspaceId },
          channel: { id: 'C_STANDBY_CH' },
          message: { thread_ts: '1700000000.007777' },
        },
        client: mockClient,
      });

      expect(viewsOpenSpy).toHaveBeenCalledTimes(1);
      const openedModal = viewsOpenSpy.mock.calls[0][0].view;
      expect(JSON.parse(openedModal.private_metadata)).toEqual({
        channelId: 'C_STANDBY_CH',
        threadTs: '1700000000.007777',
        huddleMode: true,
      });
    });

    it('handles in-thread @Pollito / pollito triggers (both interactive prompt button and inline quoted poll creation)', async () => {
      const eventHandlers: Map<string, Function> = new Map();
      const mockApp = {
        event: (name: string, handler: Function) => eventHandlers.set(name, handler),
      } as any;

      registerEventHandlers(mockApp);
      const messageHandler = eventHandlers.get('message')!;

      const postMessageSpy = vi
        .fn()
        .mockResolvedValue({ ok: true, ts: '1700000000.007779' });
      const updateSpy = vi.fn().mockResolvedValue({ ok: true });
      const mockClient = {
        auth: { test: vi.fn().mockResolvedValue({ user_id: 'B_BOT' }) },
        conversations: {
          join: vi.fn().mockResolvedValue({ ok: true }),
          members: vi
            .fn()
            .mockResolvedValue({ members: ['U1', 'U2'], response_metadata: {} }),
        },
        chat: {
          postMessage: postMessageSpy,
          update: updateSpy,
          postEphemeral: vi.fn().mockResolvedValue({ ok: true }),
        },
      } as any;

      // 1. Typing `@Pollito` in a thread posts the interactive thread prompt button
      await messageHandler({
        event: {
          channel: 'C_THREAD_TRIGGER_CH',
          user: 'U_THREAD_USER',
          ts: '1700000000.007771',
          thread_ts: '1700000000.007770',
          text: '@Pollito',
        },
        body: { team_id: workspaceId },
        client: mockClient,
      });

      expect(postMessageSpy).toHaveBeenCalledTimes(1);
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C_THREAD_TRIGGER_CH',
          thread_ts: '1700000000.007770',
        })
      );
      const promptButton = postMessageSpy.mock.calls[0][0].blocks[0].accessory;
      expect(promptButton.action_id).toBe('open_huddle_poll_modal_action');
      expect(JSON.parse(promptButton.value)).toEqual({
        channelId: 'C_THREAD_TRIGGER_CH',
        threadTs: '1700000000.007770',
      });

      // 2. Typing `pollito "Deploy now?" "Yes" "Wait"` in a thread creates the poll directly in that thread
      postMessageSpy.mockClear();
      await messageHandler({
        event: {
          channel: 'C_THREAD_TRIGGER_CH',
          user: 'U_THREAD_USER',
          ts: '1700000000.007772',
          thread_ts: '1700000000.007770',
          text: 'pollito "Deploy now?" "Yes" "Wait"',
        },
        body: { team_id: workspaceId },
        client: mockClient,
      });

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C_THREAD_TRIGGER_CH',
          thread_ts: '1700000000.007770',
        })
      );
      expect(updateSpy).toHaveBeenCalledTimes(1);

      const inlinePoll = await prisma.poll.findFirst({
        where: {
          channelId: 'C_THREAD_TRIGGER_CH',
          question: 'Deploy now?',
        },
      });
      expect(inlinePoll?.threadTs).toBe('1700000000.007770');

      // 3. Sharing a YouTube link, tagging another coworker, or chatting in a thread stays completely silent
      postMessageSpy.mockClear();
      updateSpy.mockClear();

      // Normal YouTube link shared in thread
      await messageHandler({
        event: {
          channel: 'C_THREAD_TRIGGER_CH',
          user: 'U_THREAD_USER',
          ts: '1700000000.007773',
          thread_ts: '1700000000.007770',
          text: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        },
        body: { team_id: workspaceId },
        client: mockClient,
      });

      // Tagging another coworker in thread
      await messageHandler({
        event: {
          channel: 'C_THREAD_TRIGGER_CH',
          user: 'U_THREAD_USER',
          ts: '1700000000.007774',
          thread_ts: '1700000000.007770',
          text: '<@U_COWORKER> check out this video https://youtu.be/dQw4w9WgXcQ',
        },
        body: { team_id: workspaceId },
        client: mockClient,
      });

      // Normal chat in thread
      await messageHandler({
        event: {
          channel: 'C_THREAD_TRIGGER_CH',
          user: 'U_THREAD_USER',
          ts: '1700000000.007775',
          thread_ts: '1700000000.007770',
          text: 'Thanks for sharing the video!',
        },
        body: { team_id: workspaceId },
        client: mockClient,
      });

      expect(postMessageSpy).not.toHaveBeenCalled();
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('opens the modal locked to the thread channelId and threadTs from create_poll_thread_shortcut and auto-detects active Huddle on submit from create_poll_shortcut', async () => {
      const shortcutHandlers: Map<string, Function> = new Map();
      const viewHandlers: Map<string, Function> = new Map();
      const mockApp = {
        command: vi.fn(),
        shortcut: (id: string, handler: Function) => shortcutHandlers.set(id, handler),
        view: (id: string, handler: Function) => viewHandlers.set(id, handler),
      } as any;

      registerCommandHandlers(mockApp);
      registerViewHandlers(mockApp);

      const threadShortcutHandler = shortcutHandlers.get('create_poll_thread_shortcut')!;
      const globalShortcutHandler = shortcutHandlers.get('create_poll_shortcut')!;
      const viewHandler = viewHandlers.get('create_poll_modal_submit')!;
      expect(threadShortcutHandler).toBeDefined();
      expect(globalShortcutHandler).toBeDefined();

      const viewsOpenSpy = vi.fn().mockResolvedValue({ ok: true });
      const postMessageSpy = vi
        .fn()
        .mockResolvedValue({ ok: true, ts: '1700000000.008889' });
      const updateSpy = vi.fn().mockResolvedValue({ ok: true });

      const mockClient = {
        auth: { test: vi.fn().mockResolvedValue({ user_id: 'B_BOT' }) },
        conversations: {
          join: vi.fn().mockResolvedValue({ ok: true }),
          history: vi.fn().mockResolvedValue({
            messages: [
              {
                ts: '1700000000.008880',
                subtype: 'huddle_thread',
                text: 'A huddle started',
              },
            ],
          }),
          members: vi
            .fn()
            .mockResolvedValue({ members: ['U1', 'U2'], response_metadata: {} }),
        },
        views: {
          open: viewsOpenSpy,
        },
        chat: {
          postMessage: postMessageSpy,
          update: updateSpy,
        },
      } as any;

      // 1. Message shortcut on a thread message locks modal to channelId and threadTs
      await threadShortcutHandler({
        shortcut: {
          trigger_id: 'TRIG_SHORTCUT_1',
          user: { id: 'U_SHORTCUT_USER' },
          team: { id: workspaceId },
          channel: { id: 'C_SHORTCUT_CH' },
          message: { ts: '1700000000.008881', thread_ts: '1700000000.008880' },
        },
        ack: vi.fn().mockResolvedValue(undefined),
        body: {},
        client: mockClient,
      });

      expect(viewsOpenSpy).toHaveBeenCalledTimes(1);
      const threadModal = viewsOpenSpy.mock.calls[0][0].view;
      expect(JSON.parse(threadModal.private_metadata)).toEqual({
        channelId: 'C_SHORTCUT_CH',
        threadTs: '1700000000.008880',
        huddleMode: true,
      });

      // 2. Global shortcut invoked from `/` menu inside a Huddle thread (where channelId is filled by default_to_current_conversation on client)
      viewsOpenSpy.mockClear();
      clearCachedActiveHuddles();

      await globalShortcutHandler({
        shortcut: {
          trigger_id: 'TRIG_GLOBAL_1',
          user: { id: 'U_SHORTCUT_USER' },
          team: { id: workspaceId },
        },
        ack: vi.fn().mockResolvedValue(undefined),
        body: {},
        client: mockClient,
      });

      expect(viewsOpenSpy).toHaveBeenCalledTimes(1);
      const globalModal = viewsOpenSpy.mock.calls[0][0].view;
      const channelBlock = globalModal.blocks.find(
        (b: any) => b.block_id === 'channel_block'
      );
      expect(channelBlock.element.default_to_current_conversation).toBe(true);

      // 3. Submitting that modal for C_SHORTCUT_CH auto-detects the active Huddle thread 1700000000.008880 and posts inside it
      await viewHandler({
        ack: vi.fn().mockResolvedValue(undefined),
        view: {
          private_metadata: globalModal.private_metadata,
          state: {
            values: {
              channel_block: {
                channel_select: { selected_conversation: 'C_SHORTCUT_CH' },
              },
              question_block: {
                question_input: { value: 'Global Shortcut Huddle Poll?' },
              },
              option_1_block: { option_1_input: { value: 'Yes' } },
              option_2_block: { option_2_input: { value: 'No' } },
              quorum_block: { quorum_input: { value: '70' } },
            },
          },
        },
        body: { user: { id: 'U_SHORTCUT_USER' }, team: { id: workspaceId } },
        client: mockClient,
      });

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C_SHORTCUT_CH',
          thread_ts: '1700000000.008880',
        })
      );
    });
  });
});

