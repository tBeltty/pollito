import { describe, it, expect } from 'vitest';
import { buildCreatePollModalView } from '../../src/slack/ui/views/createPollModal.js';
import {
  buildAppHomeView,
  buildPollsCsvReport,
  buildCsvExportModalView,
  type PollSummary,
} from '../../src/slack/ui/views/appHome.js';

describe('Modal & App Home Views', () => {
  it('buildCreatePollModalView includes channel selector with initial_conversation when channelId is provided', () => {
    const modal = buildCreatePollModalView('C12345');
    expect(modal.type).toBe('modal');
    expect(modal.callback_id).toBe('create_poll_modal_submit');

    const channelBlock = modal.blocks.find(
      (b: any) => b.block_id === 'channel_block'
    ) as any;

    expect(channelBlock).toBeDefined();
    expect(channelBlock.element.type).toBe('conversations_select');
    expect(channelBlock.element.initial_conversation).toBe('C12345');
  });

  it('buildCreatePollModalView omits initial_conversation when channelId is empty (from App Home)', () => {
    const modal = buildCreatePollModalView('');
    const channelBlock = modal.blocks.find(
      (b: any) => b.block_id === 'channel_block'
    ) as any;

    expect(channelBlock).toBeDefined();
    expect(channelBlock.element.type).toBe('conversations_select');
    expect(channelBlock.element.initial_conversation).toBeUndefined();
  });

  it('buildCreatePollModalView enforces number_input bounds, max_length constraints, and allow_multiple_votes checkbox', () => {
    const modal = buildCreatePollModalView('C12345');

    const questionBlock = modal.blocks.find(
      (b: any) => b.block_id === 'question_block'
    ) as any;
    expect(questionBlock.element.max_length).toBe(150);

    for (const idx of [1, 2, 3, 4]) {
      const optBlock = modal.blocks.find(
        (b: any) => b.block_id === `option_${idx}_block`
      ) as any;
      expect(optBlock.element.max_length).toBe(200);
    }

    const settingsBlock = modal.blocks.find(
      (b: any) => b.block_id === 'settings_block'
    ) as any;
    const optionValues = settingsBlock.element.options.map((o: any) => o.value);
    expect(optionValues).toContain('is_anonymous');
    expect(optionValues).toContain('allow_multiple_votes');

    const quorumBlock = modal.blocks.find(
      (b: any) => b.block_id === 'quorum_block'
    ) as any;
    expect(quorumBlock.element.type).toBe('number_input');
    expect(quorumBlock.element.is_decimal_allowed).toBe(false);
    expect(quorumBlock.element.min_value).toBe('10');
    expect(quorumBlock.element.max_value).toBe('100');
    expect(quorumBlock.element.initial_value).toBe('70');
  });

  it('buildCreatePollModalView supports preset templates with pre-filled question, options, checkboxes, quorum, and duration', () => {
    const modal = buildCreatePollModalView({
      channelId: 'C_PRESET',
      question: 'Which architecture RFC option do you prefer?',
      options: ['Option Alpha', 'Option Beta', 'Option Gamma'],
      isAnonymous: true,
      allowMultipleVotes: true,
      quorumTarget: 80,
      duration: '24h',
    });

    const questionBlock = modal.blocks.find(
      (b: any) => b.block_id === 'question_block'
    ) as any;
    expect(questionBlock.element.initial_value).toBe(
      'Which architecture RFC option do you prefer?'
    );

    const opt1Block = modal.blocks.find(
      (b: any) => b.block_id === 'option_1_block'
    ) as any;
    const opt3Block = modal.blocks.find(
      (b: any) => b.block_id === 'option_3_block'
    ) as any;
    expect(opt1Block.element.initial_value).toBe('Option Alpha');
    expect(opt3Block.element.initial_value).toBe('Option Gamma');

    const settingsBlock = modal.blocks.find(
      (b: any) => b.block_id === 'settings_block'
    ) as any;
    expect(settingsBlock.element.initial_options).toHaveLength(2);

    const quorumBlock = modal.blocks.find(
      (b: any) => b.block_id === 'quorum_block'
    ) as any;
    expect(quorumBlock.element.initial_value).toBe('80');

    const durationBlock = modal.blocks.find(
      (b: any) => b.block_id === 'duration_block'
    ) as any;
    expect(durationBlock.element.initial_option.value).toBe('24h');
  });

  it('buildAppHomeView renders clean anti-slop header, aggregate stats, Quick Templates, and Export CSV button', () => {
    const home = buildAppHomeView([], {
      totalActive: 3,
      totalQuorumsReached: 7,
      totalClosed: 12,
      avgParticipationPct: 84,
    });
    const headerBlock = home.blocks.find((b: any) => b.type === 'header') as any;
    expect(headerBlock.text.text).toBe('Pollito');
    expect(headerBlock.text.text).not.toContain('Workspace Dashboard');

    const serialized = JSON.stringify(home);
    expect(serialized).toContain('Active Polls');
    expect(serialized).toContain('Quorums Reached');
    expect(serialized).toContain('Closed Polls');
    expect(serialized).toContain('Avg. Participation: 84%');

    expect(serialized).toContain('app_home_launch_poll_click');
    expect(serialized).toContain('app_home_export_csv_click');
    expect(serialized).toContain('app_home_docs_click');

    expect(serialized).toContain('app_home_template_standup');
    expect(serialized).toContain('app_home_template_retro');
    expect(serialized).toContain('app_home_template_rfc');
    expect(serialized).toContain('app_home_template_lunch');
  });

  it('buildPollsCsvReport and buildCsvExportModalView format valid escaped CSV telemetry', () => {
    const samplePolls: PollSummary[] = [
      {
        id: 'poll_csv_1',
        workspaceId: 'T1',
        channelId: 'C_ENG',
        messageTs: '1700.01',
        creatorId: 'U1',
        question: 'Deploy Friday, or wait for "Monday"?',
        isAnonymous: true,
        allowMultipleVotes: false,
        quorumType: 'PERCENTAGE',
        quorumTarget: 75,
        eligibleVoterCount: 8,
        status: 'QUORUM_REACHED',
        closesAt: null,
        createdAt: new Date(1700000000000),
        closedAt: new Date(1700003600000),
        options: [
          { id: 'o1', pollId: 'poll_csv_1', text: 'Wait for Monday', index: 0, voteCount: 6 },
          { id: 'o2', pollId: 'poll_csv_1', text: 'Deploy Friday', index: 1, voteCount: 1 },
        ],
        participations: Array.from({ length: 6 }, (_, i) => ({ voterId: `U_${i}` })),
      },
    ];

    const csv = buildPollsCsvReport(samplePolls);
    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'poll_id,question,channel_id,status,is_anonymous,total_participants,quorum_target_pct,winning_option'
    );
    expect(lines[1]).toBe(
      'poll_csv_1,"Deploy Friday, or wait for ""Monday""?",C_ENG,QUORUM_REACHED,true,6,75,Wait for Monday'
    );

    const csvModal = buildCsvExportModalView(csv);
    expect(csvModal.type).toBe('modal');
    expect(JSON.stringify(csvModal)).toContain('poll_csv_1');
  });
});
