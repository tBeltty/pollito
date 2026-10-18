import type { HomeView } from '@slack/web-api';
import type { Poll, PollOption } from '@prisma/client';

export type PollSummary = Poll & {
  options: PollOption[];
  participations: { voterId: string }[];
};

export function buildAppHomeView(polls: PollSummary[]): HomeView {
  const activePolls = polls.filter((p) => p.status === 'ACTIVE');
  const completedPolls = polls.filter((p) => p.status === 'QUORUM_REACHED');

  return {
    type: 'home',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🐣 Pollito Workspace Dashboard',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Track team consensus, monitor active quorums, and launch new polls without leaving Slack.',
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
            text: `*Active Polls:*\n${activePolls.length}`,
          },
          {
            type: 'mrkdwn',
            text: `*Quorums Reached:*\n${completedPolls.length}`,
          },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '➕ Launch New Poll',
              emoji: true,
            },
            style: 'primary',
            action_id: 'app_home_launch_poll_click',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📖 Documentation',
              emoji: true,
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
          text: 'Recent Channel Polls',
          emoji: true,
        },
      },
      ...(polls.length === 0
        ? [
            {
              type: 'section' as const,
              text: {
                type: 'mrkdwn' as const,
                text: '_No polls created in this workspace yet. Type `/pollito` in any channel to launch your first poll._',
              },
            },
          ]
        : polls.slice(0, 5).map((p) => {
            const votes = p.participations.length;
            const statusLabel =
              p.status === 'QUORUM_REACHED'
                ? '🎉 Quorum reached'
                : p.status === 'ACTIVE'
                ? '🐣 Active'
                : '🔒 Closed';

            return {
              type: 'section' as const,
              text: {
                type: 'mrkdwn' as const,
                text: `*${p.question}*\nChannel: <#${p.channelId}> • *${votes}* votes • *${statusLabel}*`,
              },
            };
          })),
      {
        type: 'divider',
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Public and anonymous polls • 100% Free for your workspace',
          },
        ],
      },
    ],
  };
}
