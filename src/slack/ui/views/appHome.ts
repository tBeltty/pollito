import type {
  Block,
  HomeView,
  KnownBlock,
  ModalView,
  PlainTextOption,
} from '@slack/web-api';
import type { Poll, PollOption } from '@prisma/client';
import { defaultTranslator, type Translator } from '../../../i18n/index.js';
import { NUDGE_COOLDOWN_HOURS } from '../../../config/limits.js';

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
  templates?: Array<{ id: string; name: string; isShared?: boolean }>;
  translator?: Translator;
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
  translator?: Translator;
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
  input: string | CsvExportModalInput,
  options?: { translator?: Translator }
): ModalView {
  const parsed: CsvExportModalInput =
    typeof input === 'string' ? { csvContent: input } : input;
  const translator = parsed.translator ?? options?.translator ?? defaultTranslator;
  const { t } = translator;

  const csvContent = parsed.csvContent;
  const filters = parsed.filters;
  const polls = parsed.polls ?? [];

  const statusOptions: PlainTextOption[] = [
    {
      text: { type: 'plain_text', text: t('csv.status.all'), emoji: true },
      value: 'ALL',
    },
    {
      text: { type: 'plain_text', text: t('csv.status.quorumReached'), emoji: true },
      value: 'QUORUM_REACHED',
    },
    {
      text: { type: 'plain_text', text: t('csv.status.closed'), emoji: true },
      value: 'CLOSED',
    },
    {
      text: { type: 'plain_text', text: t('csv.status.active'), emoji: true },
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
        text: t('csv.intro'),
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
          text: t('csv.startDate.placeholder'),
          emoji: true,
        },
        ...(filters?.startDate ? { initial_date: filters.startDate } : {}),
      },
      label: {
        type: 'plain_text',
        text: t('csv.startDate.label'),
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
          text: t('csv.endDate.placeholder'),
          emoji: true,
        },
        ...(filters?.endDate ? { initial_date: filters.endDate } : {}),
      },
      label: {
        type: 'plain_text',
        text: t('csv.endDate.label'),
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
        text: t('csv.statusFilter.label'),
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
          text: t('csv.polls.placeholder'),
          emoji: true,
        },
        options: pollOptions,
        ...(initialPollOptions.length > 0
          ? { initial_options: initialPollOptions }
          : {}),
      },
      label: {
        type: 'plain_text',
        text: t('csv.polls.label'),
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
            text: t('csv.apply'),
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
      text: t('csv.title'),
      emoji: true,
    },
    close: {
      type: 'plain_text',
      text: t('common.close'),
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
  const translator =
    (statsOrOptions && 'translator' in statsOrOptions ? statsOrOptions.translator : undefined) ??
    defaultTranslator;
  const { t } = translator;

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
  const templates =
    statsOrOptions &&
    'templates' in statsOrOptions &&
    Array.isArray(statsOrOptions.templates)
      ? statsOrOptions.templates
      : [];

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
        text: t('home.recent.empty'),
      },
    });
  } else {
    for (const p of polls.slice(0, 10)) {
      const votes = p.participations.length;
      const statusLabel =
        p.status === 'QUORUM_REACHED'
          ? t('status.quorumReached')
          : p.status === 'ACTIVE'
          ? t('status.active')
          : p.status === 'TIME_EXPIRED'
          ? t('status.timeExpired')
          : t('status.closed');

      const isCreator = Boolean(currentUserId && p.creatorId === currentUserId);
      const canManagePoll = !currentUserId || isCreator || isManager;
      const roleBadge = currentUserId
        ? isCreator
          ? t('home.role.creator')
          : t('home.role.participant')
        : '';

      recentPollBlocks.push(
        { type: 'section', text: { type: 'mrkdwn', text: `*${p.question}*` } },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: t('home.recent.meta', {
                channelId: p.channelId,
                votes,
                status: statusLabel,
                role: roleBadge,
              }),
            },
          ],
        }
      );

      if (canManagePoll) {
        const actionElements: any[] = [];

        if (p.status === 'ACTIVE') {
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
                text: t('poll.nudge.button'),
                emoji: true,
              },
              action_id: 'poll_nudge_click',
              value: JSON.stringify({ pollId: p.id }),
              confirm: {
                title: {
                  type: 'plain_text',
                  text: t('poll.nudge.confirmTitle'),
                },
                text: {
                  type: 'mrkdwn',
                  text: t('poll.nudge.confirmBody', { hours: NUDGE_COOLDOWN_HOURS }),
                },
                confirm: {
                  type: 'plain_text',
                  text: t('poll.nudge.confirmSubmit'),
                },
                deny: {
                  type: 'plain_text',
                  text: t('common.cancel'),
                },
              },
            });
          }

          actionElements.push({
            type: 'button',
            text: {
              type: 'plain_text',
              text: t('poll.close.button'),
              emoji: true,
            },
            action_id: 'poll_close_click',
            value: JSON.stringify({ pollId: p.id }),
            style: 'danger',
            confirm: {
              title: {
                type: 'plain_text',
                text: t('poll.close.confirmTitle'),
              },
              text: {
                type: 'mrkdwn',
                text: t('poll.close.confirmBody'),
              },
              confirm: {
                type: 'plain_text',
                text: t('poll.close.button'),
              },
              deny: {
                type: 'plain_text',
                text: t('poll.close.confirmDeny'),
              },
            },
          });
        }

        actionElements.push({
          type: 'button',
          text: {
            type: 'plain_text',
            text: t('home.button.viewResults'),
            emoji: true,
          },
          action_id: 'poll_view_results_click',
          value: JSON.stringify({ pollId: p.id }),
        });

        actionElements.push({
          type: 'button',
          text: {
            type: 'plain_text',
            text: t('common.delete'),
            emoji: true,
          },
          action_id: 'poll_delete_click',
          value: JSON.stringify({ pollId: p.id }),
          confirm: {
            title: {
              type: 'plain_text',
              text: t('home.delete.confirmTitle'),
            },
            text: {
              type: 'mrkdwn',
              text: t('home.delete.confirmBody'),
            },
            confirm: {
              type: 'plain_text',
              text: t('common.delete'),
            },
            deny: {
              type: 'plain_text',
              text: t('common.cancel'),
            },
          },
        });

        recentPollBlocks.push({
          type: 'actions',
          block_id: `app_home_poll_actions_${p.id}`,
          elements: actionElements,
        });
      }
      if (p !== polls.slice(0, 10).at(-1)) {
        recentPollBlocks.push({ type: 'divider' });
      }
    }
  }

  const greetingText = currentUserId
    ? t('home.greeting.user', { userId: currentUserId })
    : t('home.greeting.anonymous');

  const blocks: (Block | KnownBlock)[] = [
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
            text: t('home.button.launch'),
          },
          style: 'primary',
          action_id: 'app_home_launch_poll_click',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: t('home.button.analytics'),
          },
          action_id: 'open_analytics_modal',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: t('home.button.templates'),
          },
          action_id: 'open_templates_modal',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: t('home.button.guide'),
          },
          action_id: 'open_guide_modal',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: t('home.button.settings'),
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
          text: t('home.stat.active', { count: totalActive }),
        },
        {
          type: 'mrkdwn',
          text: t('home.stat.quorums', { count: totalQuorumsReached }),
        },
        {
          type: 'mrkdwn',
          text: t('home.stat.closed', { count: totalClosed }),
        },
        {
          type: 'mrkdwn',
          text: t('home.stat.participation', { pct: avgParticipationPct }),
        },
      ],
    },
    {
      type: 'divider',
    },
    ...(templates.length > 0
      ? [
          {
            type: 'section' as const,
            text: {
              type: 'mrkdwn' as const,
              text: t('home.templates.intro'),
            },
          },
          {
            type: 'actions' as const,
            block_id: 'app_home_template_actions',
            elements: [
              ...templates.slice(0, 5).map((tpl) => ({
                type: 'button' as const,
                text: {
                  type: 'plain_text' as const,
                  text: tpl.name.slice(0, 24),
                  emoji: true,
                },
                action_id: 'app_home_template_launch',
                value: tpl.id,
              })),
              ...(isManager
                ? [
                    {
                      type: 'button' as const,
                      text: {
                        type: 'plain_text' as const,
                        text: t('home.templates.add'),
                        emoji: true,
                      },
                      action_id: 'open_create_template_modal',
                      value: 'workspace',
                    },
                  ]
                : []),
            ],
          },
        ]
      : isManager
        ? [
            {
              type: 'section' as const,
              text: {
                type: 'mrkdwn' as const,
                text: t('home.templates.emptyManager'),
              },
            },
            {
              type: 'actions' as const,
              block_id: 'app_home_template_actions',
              elements: [
                {
                  type: 'button' as const,
                  text: {
                    type: 'plain_text' as const,
                    text: t('home.templates.addWorkspace'),
                    emoji: true,
                  },
                  style: 'primary' as const,
                  action_id: 'open_create_template_modal',
                  value: 'workspace',
                },
              ],
            },
          ]
        : [
            {
              type: 'section' as const,
              text: {
                type: 'mrkdwn' as const,
                text: t('home.templates.emptyMember'),
              },
            },
          ]),
    { type: 'divider' },
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: t('home.recent.header'),
      },
    },
    ...recentPollBlocks,
    ...(polls.length > 0
      ? [
          {
            type: 'actions' as const,
            block_id: 'app_home_history_actions',
            elements: [
              {
                type: 'button' as const,
                text: {
                  type: 'plain_text' as const,
                  text: t('home.button.manageHistory'),
                  emoji: true,
                },
                action_id: 'app_home_manage_history_click',
              },
              {
                type: 'button' as const,
                text: {
                  type: 'plain_text' as const,
                  text: t('home.button.clearClosed'),
                  emoji: true,
                },
                action_id: 'app_home_clear_closed_click',
                confirm: {
                  title: {
                    type: 'plain_text' as const,
                    text: t('home.clear.confirmTitle'),
                  },
                  text: {
                    type: 'mrkdwn' as const,
                    text: t('home.clear.confirmBody'),
                  },
                  confirm: {
                    type: 'plain_text' as const,
                    text: t('home.button.clearClosed'),
                  },
                  deny: {
                    type: 'plain_text' as const,
                    text: t('common.cancel'),
                  },
                },
              },
            ],
          },
        ]
      : []),
    {
      type: 'divider',
    },
    {
      type: 'actions',
      block_id: 'app_home_utility_actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: t('home.button.exportCsv'),
          },
          action_id: 'app_home_export_csv_click',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: t('home.button.docs'),
          },
          url: 'https://pollito.tbelt.online/support.html',
          action_id: 'app_home_docs_click',
        },
      ],
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: t('home.footer'),
        },
      ],
    },
  ];

  return {
    type: 'home',
    blocks: blocks.slice(0, 98),
  };
}

export function buildManageHistoryModalView(
  polls: PollSummary[],
  options?: { translator?: Translator }
): ModalView {
  const translator = options?.translator ?? defaultTranslator;
  const { t } = translator;

  const pollOptions: PlainTextOption[] = polls.slice(0, 50).map((p) => {
    const statusLabel =
      p.status === 'QUORUM_REACHED'
        ? t('status.quorumReached')
        : p.status === 'ACTIVE'
        ? t('status.active')
        : p.status === 'TIME_EXPIRED'
        ? t('status.timeExpired')
        : t('status.closed');
    return {
      text: {
        type: 'plain_text',
        text: `${p.question.slice(0, 55)} (${statusLabel})`.slice(0, 75),
        emoji: true,
      },
      value: p.id,
    };
  });

  return {
    type: 'modal',
    callback_id: 'manage_history_modal_submit',
    title: {
      type: 'plain_text',
      text: t('history.title'),
      emoji: true,
    },
    submit: {
      type: 'plain_text',
      text: t('history.submit'),
      emoji: true,
    },
    close: {
      type: 'plain_text',
      text: t('common.cancel'),
      emoji: true,
    },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: t('history.intro'),
        },
      },
      {
        type: 'input',
        block_id: 'delete_polls_select_block',
        element: {
          type: 'multi_static_select',
          action_id: 'delete_polls_multi_select',
          placeholder: {
            type: 'plain_text',
            text: t('history.placeholder'),
            emoji: true,
          },
          options: pollOptions,
        },
        label: {
          type: 'plain_text',
          text: t('history.label'),
          emoji: true,
        },
      },
    ],
  };
}
