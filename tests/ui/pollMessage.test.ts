import { describe, it, expect } from 'vitest';
import {
  buildPollMessageBlocks,
  renderProgressBar,
  type PollWithDetails,
} from '../../src/slack/ui/views/pollMessage.js';

function createMockPoll(overrides: Partial<PollWithDetails> = {}): PollWithDetails {
  const fixedCreatedAt = new Date(1700000000000);
  const fixedClosesAt = new Date(1700086400000);

  return {
    id: 'poll_test_987654',
    workspaceId: 'T_TEST',
    channelId: 'C_TEST',
    messageTs: '1700000000.000100',
    creatorId: 'U_CREATOR',
    question: 'Which database engine should we use for the event store?',
    isAnonymous: false,
    allowMultipleVotes: false,
    quorumType: 'PERCENTAGE',
    quorumTarget: 70,
    eligibleVoterCount: 10,
    status: 'ACTIVE',
    closesAt: fixedClosesAt,
    createdAt: fixedCreatedAt,
    closedAt: null,
    options: [
      { id: 'opt_1', pollId: 'poll_test_987654', text: 'PostgreSQL', index: 0, voteCount: 0 },
      { id: 'opt_2', pollId: 'poll_test_987654', text: 'ClickHouse', index: 1, voteCount: 0 },
    ],
    participations: [],
    publicVotes: [],
    ...overrides,
  };
}

describe('Poll Message Block Kit Builder (pollMessage.ts)', () => {
  it('renders public voter mentions (<@voterId>) per option and truncates over 15 mentions with +N more', () => {
    const poll = createMockPoll({
      isAnonymous: false,
      options: [
        { id: 'opt_1', pollId: 'poll_test_987654', text: 'PostgreSQL', index: 0, voteCount: 2 },
        { id: 'opt_2', pollId: 'poll_test_987654', text: 'ClickHouse', index: 1, voteCount: 17 },
      ],
      participations: Array.from({ length: 19 }, (_, i) => ({ voterId: `U_VOTER_${i + 1}` })),
      publicVotes: [
        { voterId: 'U_ALICE', optionId: 'opt_1' },
        { voterId: 'U_BOB', optionId: 'opt_1' },
        ...Array.from({ length: 17 }, (_, i) => ({
          voterId: `U_CROWD_${i + 1}`,
          optionId: 'opt_2',
        })),
      ],
    });

    const blocks = buildPollMessageBlocks(poll);
    const serialized = JSON.stringify(blocks);

    expect(serialized).toContain('<@U_ALICE> <@U_BOB>');
    expect(serialized).toContain('<@U_CROWD_1>');
    expect(serialized).toContain('<@U_CROWD_15>');
    expect(serialized).not.toContain('<@U_CROWD_16>');
    expect(serialized).toContain('+2 more');
  });

  it('never renders <@voterId> mentions on anonymous polls even when publicVotes is supplied', () => {
    const poll = createMockPoll({
      isAnonymous: true,
      options: [
        { id: 'opt_1', pollId: 'poll_test_987654', text: 'PostgreSQL', index: 0, voteCount: 2 },
        { id: 'opt_2', pollId: 'poll_test_987654', text: 'ClickHouse', index: 1, voteCount: 0 },
      ],
      participations: [{ voterId: 'U_SECRET_1' }, { voterId: 'U_SECRET_2' }],
      publicVotes: [
        { voterId: 'U_SECRET_1', optionId: 'opt_1' },
        { voterId: 'U_SECRET_2', optionId: 'opt_1' },
      ],
    });

    const blocks = buildPollMessageBlocks(poll);
    const serialized = JSON.stringify(blocks);

    expect(serialized).not.toContain('<@U_SECRET_1>');
    expect(serialized).not.toContain('<@U_SECRET_2>');
    expect(serialized).toContain('Anonymous ballot');
  });

  it('transitions Pollito mascot micro-expressions accurately (🐣 -> 🧐 -> 🎉 / ⏰)', () => {
    // 0 votes active -> 🐣
    const newPoll = createMockPoll({ status: 'ACTIVE', participations: [] });
    const newBlocks = buildPollMessageBlocks(newPoll);
    expect(JSON.stringify(newBlocks)).toContain('🐣 *Status:*');

    // >0 votes active -> 🧐
    const activeVotingPoll = createMockPoll({
      status: 'ACTIVE',
      participations: [{ voterId: 'U_1' }],
    });
    const activeBlocks = buildPollMessageBlocks(activeVotingPoll);
    expect(JSON.stringify(activeBlocks)).toContain('🧐 *Status:*');

    // QUORUM_REACHED -> 🎉
    const quorumPoll = createMockPoll({
      status: 'QUORUM_REACHED',
      participations: [{ voterId: 'U_1' }],
    });
    const quorumBlocks = buildPollMessageBlocks(quorumPoll);
    expect(JSON.stringify(quorumBlocks)).toContain('🎉 *Status:*');

    // TIME_EXPIRED and CLOSED -> ⏰
    const expiredPoll = createMockPoll({
      status: 'TIME_EXPIRED',
      participations: [{ voterId: 'U_1' }],
    });
    const closedPoll = createMockPoll({
      status: 'CLOSED',
      participations: [{ voterId: 'U_1' }],
    });
    expect(JSON.stringify(buildPollMessageBlocks(expiredPoll))).toContain('⏰ *Status:*');
    expect(JSON.stringify(buildPollMessageBlocks(closedPoll))).toContain('⏰ *Status:*');
  });

  it('truncates header text over 150 characters safely to 150 characters', () => {
    const longQuestion = 'Q'.repeat(210);
    const poll = createMockPoll({ question: longQuestion });
    const blocks = buildPollMessageBlocks(poll);
    const headerBlock = blocks.find((b: any) => b.type === 'header') as any;

    expect(headerBlock).toBeDefined();
    expect(headerBlock.text.text.length).toBe(150);
    expect(headerBlock.text.text).toBe('Q'.repeat(150));
  });

  it('renders poll_nudge_click and poll_close_click buttons on active polls and removes them on closed polls', () => {
    const activePoll = createMockPoll({ status: 'ACTIVE' });
    const activeBlocks = buildPollMessageBlocks(activePoll);
    const activeActions = activeBlocks.find((b: any) => b.type === 'actions') as any;

    expect(activeActions).toBeDefined();
    const actionIds = activeActions.elements.map((e: any) => e.action_id);
    expect(actionIds).toContain('poll_nudge_click');
    expect(actionIds).toContain('poll_close_click');
    expect(JSON.stringify(activeBlocks)).toContain('ID: 987654');

    const closedPoll = createMockPoll({ status: 'CLOSED' });
    const closedBlocks = buildPollMessageBlocks(closedPoll);
    const closedActions = closedBlocks.find((b: any) => b.type === 'actions');
    expect(closedActions).toBeUndefined();
  });

  it('renders progress bar deterministically within 0% to 100%', () => {
    expect(renderProgressBar(0, 10)).toBe('░░░░░░░░░░ 0%');
    expect(renderProgressBar(50, 10)).toBe('█████░░░░░ 50%');
    expect(renderProgressBar(100, 10)).toBe('██████████ 100%');
  });
});
