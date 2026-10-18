import type {
  Block,
  HomeView,
  KnownBlock,
  ModalView,
  PlainTextOption,
} from '@slack/web-api';
import type { Poll, PollOption } from '@prisma/client';

export type PollSummary = Poll & {
  options: PollOption[];
  participations: { voterId: string }[];
};

export interface AppHomeStats {
  totalActive: number;
  totalQuorumsReached: number;
  totalClosed: number;
  avgParticipationPct: number;
}

export interface AppHomeViewOptions extends Partial<AppHomeStats> {
  currentUserId?: string;
  isManager?: boolean;
  maxNudgeChannelMembers?: number;
  allowVoterChoiceNudges?: boolean;
}

export interface CsvFilterOptions {
  startDate?: string;
  endDate?: string;
  status?: 'ALL' | 'QUORUM_REACHED' | 'CLOSED' | 'ACTIVE';
  selectedPollIds?: string[];
}

export interface CsvExportModalInput {
  csvContent: string;
  polls?: PollSummary[];
  filters?: CsvFilterOptions;
}

function escapeCsvCell(value: string | number | boolean): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildPollsCsvReport(polls: PollSummary[]): string {
  const header =
    'poll_id,question,channel_id,status,is_anonymous,total_participants,quorum_target_pct,winning_option';
  const rows = polls.map((p) => {
    const maxVotes = p.options.reduce((max, o) => Math.max(max, o.voteCount), 0);
    const topOptions =
      maxVotes > 0 ? p.options.filter((o) => o.voteCount === maxVotes) : [];
    const winningOption =
      maxVotes === 0
        ? 'No votes'
        : topOptions.length > 1
          ? `Tie: ${topOptions.map((o) => o.text).join(' / ')}`
          : topOptions[0].text;

    return [
      escapeCsvCell(p.id),
      escapeCsvCell(p.question),
      escapeCsvCell(p.channelId),
      escapeCsvCell(p.status),
      escapeCsvCell(p.isAnonymous),
      escapeCsvCell(p.participations.length),
      escapeCsvCell(p.quorumTarget),
      escapeCsvCell(winningOption),
    ].join(',');
  });

  return [header, ...rows].join('\n');
}

export function buildCsvExportModalView(
  input: string | CsvExportModalInput
): ModalView {
  const parsed: CsvExportModalInput =
    typeof input === 'string' ? { csvContent: input } : input;
  const csvContent = parsed.csvContent;
  const filters = parsed.filters;
  const polls = parsed.polls ?? [];

  const statusOptions: PlainTextOption[] = [
    {
      text: { type: 'plain_text', text: 'All Poll Statuses', emoji: true },
      value: 'ALL',
    },
    {
      text: { type: 'plain_text', text: 'Quorum Reached Only', emoji: true },
      value: 'QUORUM_REACHED',
    },
    {
      text: { type: 'plain_text', text: 'Closed Polls Only', emoji: true },
      value: 'CLOSED',
    },
    {
      text: { type: 'plain_text', text: 'Active Polls Only', emoji: true },
      value: 'ACTIVE',
    },
  ];

  const selectedStatusOption =
    statusOptions.find((opt) => opt.value === (filters?.status ?? 'ALL')) ??
    statusOptions[0];

  const blocks: (Block | KnownBlock)[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Filter your poll records by date, status, or specific questions, then copy the CSV data below:',
      },
    },
    {
      type: 'input',
      block_id: 'csv_start_date_block',
      optional: true,
      element: {
        type: 'datepicker',
        action_id: 'csv_start_date_select',
        placeholder: {
          type: 'plain_text',
          text: 'Select start date',
          emoji: true,
        },
        ...(filters?.startDate ? { initial_date: filters.startDate } : {}),
      },
      label: {
        type: 'plain_text',
        text: 'Start Date (Optional)',
        emoji: true,
      },
    },
    {
      type: 'input',
      block_id: 'csv_end_date_block',
      optional: true,
      element: {
        type: 'datepicker',
        action_id: 'csv_end_date_select',
        placeholder: {
          type: 'plain_text',
          text: 'Select end date',
          emoji: true,
        },
        ...(filters?.endDate ? { initial_date: filters.endDate } : {}),
      },
      label: {
        type: 'plain_text',
        text: 'End Date (Optional)',
        emoji: true,
      },
    },
    {
      type: 'input',
      block_id: 'csv_status_filter_block',
      optional: true,
      element: {
        type: 'static_select',
        action_id: 'csv_status_filter_select',
        options: statusOptions,
        initial_option: selectedStatusOption,
      },
      label: {
        type: 'plain_text',
        text: 'Poll Status Filter',
        emoji: true,
      },
    },
  ];

  if (polls.length > 0) {
    const pollOptions: PlainTextOption[] = polls.slice(0, 50).map((p) => ({
      text: {
        type: 'plain_text',
        text: `${p.question.slice(0, 55)} (${p.id.slice(-6)})`,
        emoji: true,
      },
      value: p.id,
    }));

    const initialPollOptions = filters?.selectedPollIds
      ? pollOptions.filter(
          (opt) => opt.value !== undefined && filters.selectedPollIds!.includes(opt.value)
        )
      : [];

    blocks.push({
      type: 'input',
      block_id: 'csv_polls_select_block',
      optional: true,
      element: {
        type: 'multi_static_select',
        action_id: 'csv_polls_multi_select',
        placeholder: {
          type: 'plain_text',
          text: 'All polls in range (or pick specific polls)',
          emoji: true,
        },
        options: pollOptions,
        ...(initialPollOptions.length > 0
          ? { initial_options: initialPollOptions }
          : {}),
      },
      label: {
        type: 'plain_text',
        text: 'Specific Polls to Export',
        emoji: true,
      },
    });
  }

  blocks.push(
    {
      type: 'actions',
      block_id: 'csv_filter_actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Apply Filters',
            emoji: true,
          },
          style: 'primary',
          action_id: 'csv_apply_filters_click',
        },
      ],
    },
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `\`\`\`\n${csvContent.slice(0, 2900)}\n\`\`\``,
      },
    }
  );

  return {
    type: 'modal',
    callback_id: 'csv_export_modal',
    title: {
      type: 'plain_text',
      text: 'Export Polls CSV',
      emoji: true,
    },
    close: {
      type: 'plain_text',
      text: 'Close',
      emoji: true,
    },
    blocks,
  };
}

export function computeAppHomeStats(polls: PollSummary[]): AppHomeStats {
  const totalActive = polls.filter((p) => p.status === 'ACTIVE').length;
  const totalQuorumsReached = polls.filter((p) => p.status === 'QUORUM_REACHED').length;
  const totalClosed = polls.filter(
    (p) =>
      p.status === 'CLOSED' ||
      p.status === 'TIME_EXPIRED' ||
      p.status === 'QUORUM_REACHED'
  ).length;

  const eligiblePolls = polls.filter((p) => p.eligibleVoterCount > 0);
  const avgParticipationPct =
    eligiblePolls.length > 0
      ? Math.round(
          eligiblePolls.reduce(
            (acc, p) =>
              acc + Math.min(100, (p.participations.length / p.eligibleVoterCount) * 100),
            0
          ) / eligiblePolls.length
        )
      : 0;

  return {
    totalActive,
    totalQuorumsReached,
    totalClosed,
    avgParticipationPct,
  };
}

export function buildAppHomeView(
  polls: PollSummary[],
  statsOrOptions?: AppHomeStats | AppHomeViewOptions
): HomeView {
  const computed = computeAppHomeStats(polls);
  const currentUserId =
    statsOrOptions && 'currentUserId' in statsOrOptions
      ? statsOrOptions.currentUserId
      : undefined;
  const isManager =
    statsOrOptions && 'isManager' in statsOrOptions
      ? Boolean(statsOrOptions.isManager)
      : false;
  const maxNudgeChannelMembers =
    statsOrOptions &&
    'maxNudgeChannelMembers' in statsOrOptions &&
    statsOrOptions.maxNudgeChannelMembers !== undefined
      ? statsOrOptions.maxNudgeChannelMembers
      : 50;
  const allowVoterChoiceNudges =
    statsOrOptions &&
    'allowVoterChoiceNudges' in statsOrOptions &&
    statsOrOptions.allowVoterChoiceNudges !== undefined
      ? statsOrOptions.allowVoterChoiceNudges
      : true;

  const totalActive = statsOrOptions?.totalActive ?? computed.totalActive;
  const totalQuorumsReached =
    statsOrOptions?.totalQuorumsReached ?? computed.totalQuorumsReached;
  const totalClosed = statsOrOptions?.totalClosed ?? computed.totalClosed;
  const avgParticipationPct =
    statsOrOptions?.avgParticipationPct ?? computed.avgParticipationPct;

  const recentPollBlocks: (Block | KnownBlock)[] = [];

  if (polls.length === 0) {
    recentPollBlocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '_No polls yet. Type `/pollito` in any channel or click "Launch New Poll" above._',
      },
    });
  } else {
    for (const p of polls.slice(0, 10)) {
      const votes = p.participations.length;
      const statusLabel =
        p.status === 'QUORUM_REACHED'
          ? 'Quorum reached'
          : p.status === 'ACTIVE'
          ? 'Active'
          : p.status === 'TIME_EXPIRED'
          ? 'Time expired'
          : 'Closed';

      const isCreator = Boolean(currentUserId && p.creatorId === currentUserId);
      const canManagePoll = !currentUserId || isCreator || isManager;
      const roleBadge = currentUserId
        ? isCreator
          ? ' • *You are the creator*'
          : ' • _Participant_'
        : '';

      const sectionBlock: any = {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${p.question}*\nChannel: <#${p.channelId}> • *${votes}* votes • *${statusLabel}*${roleBadge}`,
        },
      };

      if (p.status !== 'ACTIVE' && canManagePoll) {
        sectionBlock.accessory = {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View Results',
            emoji: true,
          },
          action_id: 'poll_view_results_click',
          value: JSON.stringify({ pollId: p.id }),
        };
      }

      recentPollBlocks.push(sectionBlock);

      if (p.status === 'ACTIVE' && canManagePoll) {
        const actionElements: any[] = [];
        const canOfferNudge =
          isCreator &&
          allowVoterChoiceNudges !== false &&
          (p.eligibleVoterCount <= 0 ||
            p.eligibleVoterCount <= maxNudgeChannelMembers);

        if (canOfferNudge) {
          actionElements.push({
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Nudge Non-Voters',
              emoji: true,
            },
            action_id: 'poll_nudge_click',
            value: JSON.stringify({ pollId: p.id }),
            confirm: {
              title: {
                type: 'plain_text',
                text: 'Send reminder to non-voters?',
              },
              text: {
                type: 'mrkdwn',
                text: 'Pollito will send a private DM reminder to eligible members in this channel who have not voted yet. Only the poll creator can trigger reminders (4-hour cooldown applies).',
              },
              confirm: {
                type: 'plain_text',
                text: 'Send Reminders',
              },
              deny: {
                type: 'plain_text',
                text: 'Cancel',
              },
            },
          });
        }

        actionElements.push({
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Close Poll',
            emoji: true,
          },
          action_id: 'poll_close_click',
          value: JSON.stringify({ pollId: p.id }),
          style: 'danger',
          confirm: {
            title: {
              type: 'plain_text',
              text: 'Close this poll now?',
            },
            text: {
              type: 'mrkdwn',
              text: 'Voting will end immediately and final results will be posted to the thread.',
            },
            confirm: {
              type: 'plain_text',
              text: 'Close Poll',
            },
            deny: {
              type: 'plain_text',
              text: 'Keep Open',
            },
          },
        });

        actionElements.push({
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View Results',
            emoji: true,
          },
          action_id: 'poll_view_results_click',
          value: JSON.stringify({ pollId: p.id }),
        });

        recentPollBlocks.push({
          type: 'actions',
          block_id: `app_home_poll_actions_${p.id}`,
          elements: actionElements,
        });
      }
    }
  }

  const greetingText = currentUserId
    ? `Hi, <@${currentUserId}> — team polls, consensus thresholds, and results in one place.`
    : 'Team polls, vote progress, and consensus thresholds in one place.';

  const blocks: (Block | KnownBlock)[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'Pollito',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: greetingText,
      },
    },
    {
      type: 'actions',
      block_id: 'app_home_top_actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Launch New Poll',
          },
          style: 'primary',
          action_id: 'app_home_launch_poll_click',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Results & Analytics',
          },
          action_id: 'open_analytics_modal',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Templates',
          },
          action_id: 'open_templates_modal',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Guide',
          },
          action_id: 'open_guide_modal',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Settings',
          },
          action_id: 'open_settings_modal',
        },
      ],
    },
    {
      type: 'divider',
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Active Polls:*\n${totalActive}`,
        },
        {
          type: 'mrkdwn',
          text: `*Quorums Reached:*\n${totalQuorumsReached}`,
        },
        {
          type: 'mrkdwn',
          text: `*Closed Polls:*\n${totalClosed}`,
        },
        {
          type: 'mrkdwn',
          text: `*Avg. Participation:*\nAvg. Participation: ${avgParticipationPct}%`,
        },
      ],
    },
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Quick Templates & Export*\nLaunch a pre-configured engineering poll or export CSV records.',
      },
    },
    {
      type: 'actions',
      block_id: 'app_home_template_actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Standup Check',
            emoji: true,
          },
          action_id: 'app_home_template_standup',
          value: 'standup',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Retro Date',
            emoji: true,
          },
          action_id: 'app_home_template_retro',
          value: 'retro',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Architecture RFC',
            emoji: true,
          },
          action_id: 'app_home_template_rfc',
          value: 'rfc',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Team Lunch',
            emoji: true,
          },
          action_id: 'app_home_template_lunch',
          value: 'lunch',
        },
      ],
    },
    {
      type: 'actions',
      block_id: 'app_home_utility_actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Export CSV',
          },
          action_id: 'app_home_export_csv_click',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Documentation',
          },
          url: 'https://pollito.tbelt.online/support.html',
          action_id: 'app_home_docs_click',
        },
      ],
    },
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'Recent Polls',
      },
    },
    ...recentPollBlocks,
    {
      type: 'divider',
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'Public and anonymous polls • Quorum & Huddle thread support',
        },
      ],
    },
  ];

  return {
    type: 'home',
    blocks: blocks.slice(0, 98),
  };
}
