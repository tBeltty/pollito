import { describe, it, expect } from 'vitest';
import { buildCreatePollModalView } from '../../src/slack/ui/views/createPollModal.js';
import {
  buildAppHomeView,
  buildPollsCsvReport,
  buildCsvExportModalView,
  type PollSummary,
} from '../../src/slack/ui/views/appHome.js';
import {
  buildAnalyticsModalView,
  buildPollDetailModalView,
} from '../../src/slack/ui/views/analyticsModal.js';
import { buildTemplatesModalView } from '../../src/slack/ui/views/templatesModal.js';
import { buildSettingsModalView } from '../../src/slack/ui/views/settingsModal.js';
import { buildGuideModalView } from '../../src/slack/ui/views/guideModal.js';

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

  it('buildCreatePollModalView enforces number_input bounds (>= 51%), no_quorum checkbox, 7d duration, and save_template_block', () => {
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
    expect(optionValues).toContain('no_quorum');

    const quorumBlock = modal.blocks.find(
      (b: any) => b.block_id === 'quorum_block'
    ) as any;
    expect(quorumBlock.optional).toBe(true);
    expect(quorumBlock.element.type).toBe('number_input');
    expect(quorumBlock.element.is_decimal_allowed).toBe(false);
    expect(quorumBlock.element.min_value).toBe('51');
    expect(quorumBlock.element.max_value).toBe('100');
    expect(quorumBlock.element.initial_value).toBe('70');

    const durationBlock = modal.blocks.find(
      (b: any) => b.block_id === 'duration_block'
    ) as any;
    const durationValues = durationBlock.element.options.map((o: any) => o.value);
    expect(durationValues).toContain('7d');

    const saveTemplateBlock = modal.blocks.find(
      (b: any) => b.block_id === 'save_template_block'
    ) as any;
    expect(saveTemplateBlock).toBeDefined();
    expect(saveTemplateBlock.element.action_id).toBe('save_template_checkbox');
    const saveOptionValues = saveTemplateBlock.element.options.map((o: any) => o.value);
    expect(saveOptionValues).toContain('save_as_template');
    expect(saveOptionValues).toContain('is_shared');
    expect(saveTemplateBlock.element.initial_options).toBeUndefined();

    const preSharedModal = buildCreatePollModalView({
      isShared: true,
      saveAsTemplate: true,
    });
    const preSharedSaveBlock = preSharedModal.blocks.find(
      (b: any) => b.block_id === 'save_template_block'
    ) as any;
    const preSharedValues = preSharedSaveBlock.element.initial_options.map((o: any) => o.value);
    expect(preSharedValues).toContain('save_as_template');
    expect(preSharedValues).toContain('is_shared');

    const templateNameBlock = modal.blocks.find(
      (b: any) => b.block_id === 'template_name_block'
    ) as any;
    expect(templateNameBlock).toBeDefined();
    const templateCreateModal = buildCreatePollModalView({
      createTemplateMode: true,
      isShared: true,
      templateName: 'Admin Standup',
      question: 'Standup Blockers?',
      options: ['Clear', 'Blocked'],
    });
    expect(templateCreateModal.callback_id).toBe('create_template_modal_submit');
    expect(templateCreateModal.title.text).toBe('New workspace template');
    expect(templateCreateModal.submit?.text).toBe('Create template');
    expect(
      templateCreateModal.blocks.some((b: any) => b.block_id === 'template_share_block')
    ).toBe(true);
  });

  it('buildCreatePollModalView supports preset templates, threadTs metadata, and editTemplateId mode', () => {
    const modal = buildCreatePollModalView({
      channelId: 'C_PRESET',
      threadTs: '1700000100.000200',
      question: 'Which architecture RFC option do you prefer?',
      options: ['Option Alpha', 'Option Beta', 'Option Gamma'],
      isAnonymous: true,
      allowMultipleVotes: true,
      quorumType: 'NONE',
      quorumTarget: 40, // Clamped to 51
      duration: '7d',
      editTemplateId: 'tpl_123',
      templateName: 'RFC Template',
    });

    expect(modal.callback_id).toBe('edit_template_modal_submit');
    expect(modal.title.text).toBe('Edit poll template');
    expect(JSON.parse(modal.private_metadata!)).toEqual({
      channelId: 'C_PRESET',
      threadTs: '1700000100.000200',
      editTemplateId: 'tpl_123',
    });

    const settingsBlock = modal.blocks.find(
      (b: any) => b.block_id === 'settings_block'
    ) as any;
    expect(settingsBlock.element.initial_options).toHaveLength(3);

    const quorumBlock = modal.blocks.find(
      (b: any) => b.block_id === 'quorum_block'
    ) as any;
    expect(quorumBlock.element.initial_value).toBe('51');

    const durationBlock = modal.blocks.find(
      (b: any) => b.block_id === 'duration_block'
    ) as any;
    expect(durationBlock.element.initial_option.value).toBe('7d');
  });

  it('buildAppHomeView renders HuddlePace-style top bar, role badges, and creator-only Nudge button on small channels', () => {
    const samplePolls: PollSummary[] = [
      {
        id: 'poll_creator_small',
        workspaceId: 'T1',
        channelId: 'C_SMALL',
        messageTs: '1700.01',
        creatorId: 'U_ALICE',
        question: 'Creator poll in 12-member channel',
        isAnonymous: false,
        allowMultipleVotes: false,
        quorumType: 'PERCENTAGE',
        quorumTarget: 70,
        eligibleVoterCount: 12,
        status: 'ACTIVE',
        closesAt: null,
        createdAt: new Date(1700000000000),
        closedAt: null,
        options: [],
        participations: [{ voterId: 'U_ALICE' }],
      } as any,
      {
        id: 'poll_creator_huge',
        workspaceId: 'T1',
        channelId: 'C_HUGE',
        messageTs: '1700.02',
        creatorId: 'U_ALICE',
        question: 'Creator poll in 500-member channel',
        isAnonymous: false,
        allowMultipleVotes: false,
        quorumType: 'PERCENTAGE',
        quorumTarget: 70,
        eligibleVoterCount: 500,
        status: 'ACTIVE',
        closesAt: null,
        createdAt: new Date(1700000000000),
        closedAt: null,
        options: [],
        participations: [],
      } as any,
      {
        id: 'poll_other',
        workspaceId: 'T1',
        channelId: 'C_SMALL',
        messageTs: '1700.03',
        creatorId: 'U_BOB',
        question: 'Poll created by someone else',
        isAnonymous: true,
        allowMultipleVotes: false,
        quorumType: 'PERCENTAGE',
        quorumTarget: 70,
        eligibleVoterCount: 10,
        status: 'ACTIVE',
        closesAt: null,
        createdAt: new Date(1700000000000),
        closedAt: null,
        options: [],
        participations: [],
      } as any,
    ];

    const home = buildAppHomeView(samplePolls, {
      currentUserId: 'U_ALICE',
      isManager: false,
      maxNudgeChannelMembers: 50,
      allowVoterChoiceNudges: true,
      totalActive: 3,
      totalQuorumsReached: 7,
      totalClosed: 12,
      avgParticipationPct: 84,
    });

    const serialized = JSON.stringify(home);
    expect(serialized).toContain('Hi, <@U_ALICE>');
    expect(serialized).toContain('open_analytics_modal');
    expect(serialized).toContain('open_templates_modal');
    expect(serialized).toContain('open_guide_modal');
    expect(serialized).toContain('open_settings_modal');
    expect(serialized).toContain('You created this');
    expect(serialized).toContain('Participant');

    // Creator on small channel gets Nudge Non-Voters with confirm dialog
    const smallPollActions = home.blocks.find(
      (b: any) => b.block_id === 'app_home_poll_actions_poll_creator_small'
    ) as any;
    expect(smallPollActions).toBeDefined();
    expect(
      smallPollActions.elements.some((e: any) => e.action_id === 'poll_nudge_click')
    ).toBe(true);

    // Creator on 500-member channel does NOT get Nudge Non-Voters
    const hugePollActions = home.blocks.find(
      (b: any) => b.block_id === 'app_home_poll_actions_poll_creator_huge'
    ) as any;
    expect(hugePollActions).toBeDefined();
    expect(
      hugePollActions.elements.some((e: any) => e.action_id === 'poll_nudge_click')
    ).toBe(false);

    // Non-creator / non-manager does NOT get management action block for U_BOB's poll
    const otherPollActions = home.blocks.find(
      (b: any) => b.block_id === 'app_home_poll_actions_poll_other'
    );
    expect(otherPollActions).toBeUndefined();
  });

  it('buildPollsCsvReport and customizable buildCsvExportModalView format valid escaped CSV and interactive filters', () => {
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
      } as any,
      {
        id: 'poll_csv_tie',
        workspaceId: 'T1',
        channelId: 'C_ENG',
        messageTs: '1700.02',
        creatorId: 'U1',
        question: 'Tied poll',
        isAnonymous: false,
        allowMultipleVotes: false,
        quorumType: 'PERCENTAGE',
        quorumTarget: 70,
        eligibleVoterCount: 6,
        status: 'CLOSED',
        closesAt: null,
        createdAt: new Date(1700000000000),
        closedAt: new Date(1700003600000),
        options: [
          { id: 'o3', pollId: 'poll_csv_tie', text: 'Alpha', index: 0, voteCount: 3 },
          { id: 'o4', pollId: 'poll_csv_tie', text: 'Beta', index: 1, voteCount: 3 },
        ],
        participations: Array.from({ length: 6 }, (_, i) => ({ voterId: `U_${i}` })),
      } as any,
    ];

    const csv = buildPollsCsvReport(samplePolls);
    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'poll_id,question,channel_id,status,is_anonymous,total_participants,quorum_target_pct,winning_option'
    );
    expect(lines[1]).toBe(
      'poll_csv_1,"Deploy Friday, or wait for ""Monday""?",C_ENG,QUORUM_REACHED,true,6,75,Wait for Monday'
    );
    expect(lines[2]).toBe(
      'poll_csv_tie,Tied poll,C_ENG,CLOSED,false,6,70,Tie: Alpha / Beta'
    );

    const csvModal = buildCsvExportModalView({
      csvContent: csv,
      polls: samplePolls,
      filters: { status: 'QUORUM_REACHED', startDate: '2026-01-01' },
    });
    expect(csvModal.type).toBe('modal');
    const serialized = JSON.stringify(csvModal);
    expect(serialized).toContain('csv_start_date_select');
    expect(serialized).toContain('csv_end_date_select');
    expect(serialized).toContain('csv_status_filter_select');
    expect(serialized).toContain('csv_polls_multi_select');
    expect(serialized).toContain('csv_apply_filters_click');
    expect(serialized).toContain('poll_csv_1');
    expect(serialized).toContain('copy the CSV data below:');
  });

  it('builds Analytics, Templates, Settings (editable + read-only), and Guide modals cleanly', () => {
    const analyticsModal = buildAnalyticsModalView({
      scope: 'personal',
      totalPolls: 2,
      totalActive: 1,
      totalClosed: 1,
      totalQuorumsReached: 1,
      quorumComplianceRate: 100,
      avgParticipationPct: 85,
      totalBallotsCast: 14,
      publicPollsCount: 1,
      anonymousPollsCount: 1,
      polls: [
        {
          id: 'p_anon',
          question: 'Anonymous RFC Poll',
          channelId: 'C1',
          status: 'QUORUM_REACHED',
          isAnonymous: true,
          options: [{ id: 'o1', text: 'Approve', voteCount: 5 }],
          participations: Array.from({ length: 5 }, (_, i) => ({ voterId: `U_${i}` })),
          publicVotes: [{ voterId: 'U_SECRET', optionId: 'o1' }],
        },
        {
          id: 'p_active',
          question: 'Active Sprint Poll',
          channelId: 'C1',
          status: 'ACTIVE',
          isAnonymous: false,
          options: [{ id: 'o2', text: 'Tuesday', voteCount: 3 }],
          participations: Array.from({ length: 3 }, (_, i) => ({ voterId: `U_${i}` })),
          publicVotes: [],
        },
      ],
    });
    const analyticsJson = JSON.stringify(analyticsModal);
    expect(analyticsJson).toContain('Only polls you created appear here');
    expect(analyticsJson).toContain('Winner: *Approve* (5)');
    expect(analyticsJson).toContain('Leading: *Tuesday* (3)');
    expect(analyticsJson).not.toContain('U_SECRET');

    const detailModal = buildPollDetailModalView({
      id: 'p_pub',
      question: 'Public Poll Breakdown',
      channelId: 'C1',
      creatorId: 'U_CREATOR',
      status: 'CLOSED',
      isAnonymous: false,
      allowMultipleVotes: false,
      quorumType: 'PERCENTAGE',
      quorumTarget: 70,
      eligibleVoterCount: 10,
      options: [{ id: 'o1', text: 'Ship it', voteCount: 7 }],
      participations: Array.from({ length: 7 }, (_, i) => ({ voterId: `U_${i}` })),
      publicVotes: [{ voterId: 'U_VOTER_1', optionId: 'o1' }],
    });
    const detailJson = JSON.stringify(detailModal);
    expect(detailJson).toContain('<@U_VOTER_1>');
    expect(detailJson).toContain('Winner: *Ship it* (7)');

    const templatesModal = buildTemplatesModalView(
      [
        {
          id: 'tpl_1',
          creatorId: 'U_ALICE',
          name: 'Sprint Health',
          question: 'How is sprint scope looking?',
          options: ['Solid', 'At risk'],
          isAnonymous: true,
          allowMultipleVotes: false,
          quorumType: 'PERCENTAGE',
          quorumTarget: 75,
          duration: '24h',
          isShared: true,
        },
      ],
      'U_ALICE',
      { tab: 'mine', confirmDeleteId: 'tpl_1' }
    );
    const tplJson = JSON.stringify(templatesModal);
    expect(tplJson).toContain('My templates (1)');
    expect(tplJson).toContain('Workspace templates (1)');
    expect(tplJson).toContain('confirm_delete_template');

    const readOnlySettings = buildSettingsModalView({
      canEdit: false,
      allowMultipleActivePolls: false,
      defaultAnonymous: true,
      defaultQuorumPct: 70,
      maxNudgeChannelMembers: 50,
      allowVoterChoiceNudges: true,
      managerUserIds: ['U_MGR'],
    });
    expect(readOnlySettings.submit).toBeUndefined();
    expect(JSON.stringify(readOnlySettings)).toContain('Read-only view');

    const editableSettings = buildSettingsModalView({
      canEdit: true,
      allowMultipleActivePolls: true,
      defaultAnonymous: false,
      defaultQuorumPct: 0,
      maxNudgeChannelMembers: 50,
      allowVoterChoiceNudges: true,
      managerUserIds: ['U_MGR'],
    });
    expect(editableSettings.submit?.text).toBe('Save settings');
    expect(JSON.stringify(editableSettings)).toContain('concurrency_checkboxes');

    const guideModal = buildGuideModalView();
    expect(JSON.stringify(guideModal)).toContain('/pollito huddle');
  });
});
