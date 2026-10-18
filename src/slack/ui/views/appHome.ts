import type { HomeView, ModalView, SectionBlock } from '@slack/web-api';
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
    const sortedOptions = [...p.options].sort((a, b) => b.voteCount - a.voteCount);
    const topOption = sortedOptions[0];
    const winningOption =
      topOption && topOption.voteCount > 0 ? topOption.text : 'No votes';

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

export function buildCsvExportModalView(csvContent: string): ModalView {
  return {
    type: 'modal',
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
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Copy the CSV telemetry below for your sprint records or audit spreadsheets:',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `\`\`\`\n${csvContent.slice(0, 2900)}\n\`\`\``,
        },
      },
    ],
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
  stats?: AppHomeStats
): HomeView {
  const resolvedStats = stats ?? computeAppHomeStats(polls);
  const avgParticipationPct = resolvedStats.avgParticipationPct;

  const recentPollBlocks: SectionBlock[] =
    polls.length === 0
      ? [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '_No polls yet. Type `/pollito` in any channel or click "Launch New Poll" above._',
            },
          },
        ]
      : polls.slice(0, 5).map((p): SectionBlock => {
          const votes = p.participations.length;
          const statusLabel =
            p.status === 'QUORUM_REACHED'
              ? 'Quorum reached'
              : p.status === 'ACTIVE'
              ? 'Active'
              : 'Closed';

          const block: SectionBlock = {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${p.question}*\nChannel: <#${p.channelId}> • *${votes}* votes • *${statusLabel}*`,
            },
          };

          if (p.status === 'ACTIVE') {
            block.accessory = {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Close Poll',
                emoji: true,
              },
              action_id: 'poll_close_click',
              value: JSON.stringify({ pollId: p.id }),
            };
          }

          return block;
        });

  return {
    type: 'home',
    blocks: [
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
          text: 'Team polls, vote progress, and consensus thresholds in one place.',
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Active Polls:*\n${resolvedStats.totalActive}`,
          },
          {
            type: 'mrkdwn',
            text: `*Quorums Reached:*\n${resolvedStats.totalQuorumsReached}`,
          },
          {
            type: 'mrkdwn',
            text: `*Closed Polls:*\n${resolvedStats.totalClosed}`,
          },
          {
            type: 'mrkdwn',
            text: `*Avg. Participation:*\nAvg. Participation: ${avgParticipationPct}%`,
          },
        ],
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
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Quick Templates*\nLaunch a pre-configured engineering poll with one click.',
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
            text: 'Public and anonymous polls • Free for your workspace',
          },
        ],
      },
    ],
  };
}
