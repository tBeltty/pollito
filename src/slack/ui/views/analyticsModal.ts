import type { Block, KnownBlock, ModalView } from '@slack/web-api';
import { renderProgressBar } from './pollMessage.js';

export interface AnalyticsModalStats {
  scope: 'workspace' | 'personal';
  totalPolls: number;
  totalActive: number;
  totalClosed: number;
  totalQuorumsReached: number;
  quorumComplianceRate: number;
  avgParticipationPct: number;
  totalBallotsCast: number;
  publicPollsCount: number;
  anonymousPollsCount: number;
  polls: any[];
}

function formatStatusLabel(status?: string): string {
  if (status === 'QUORUM_REACHED') return 'Quorum reached';
  if (status === 'ACTIVE') return 'Active';
  if (status === 'TIME_EXPIRED') return 'Time expired';
  return 'Closed';
}

export function buildAnalyticsModalView(
  stats: AnalyticsModalStats,
  days = 30
): ModalView {
  const scopeText =
    stats.scope === 'personal'
      ? `Your poll results and participation metrics for the *last ${days} days*. Only polls you created appear here. Workspace-wide analytics are visible to workspace admins and bot managers.`
      : `Workspace-wide poll results and participation metrics for the *last ${days} days*.`;

  const blocks: (Block | KnownBlock)[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: scopeText,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Quorum Achievement*\n*${stats.quorumComplianceRate}%* (${stats.totalQuorumsReached} reached quorum)`,
        },
        {
          type: 'mrkdwn',
          text: `*Avg. Participation*\n*${stats.avgParticipationPct}%* across eligible members`,
        },
        {
          type: 'mrkdwn',
          text: `*Total Ballots Cast*\n*${stats.totalBallotsCast}* votes across *${stats.totalPolls}* polls`,
        },
        {
          type: 'mrkdwn',
          text: `*Privacy Split*\n*${stats.publicPollsCount}* Public • *${stats.anonymousPollsCount}* Anonymous`,
        },
      ],
    },
    {
      type: 'actions',
      block_id: 'analytics_modal_actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Customize & Export CSV',
            emoji: true,
          },
          action_id: 'app_home_export_csv_click',
        },
      ],
    },
    {
      type: 'divider',
    },
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'Recent Poll Results',
      },
    },
  ];

  if (!stats.polls || stats.polls.length === 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'No polls recorded in this timeframe.',
      },
    });
  } else {
    for (const p of stats.polls.slice(0, 10)) {
      const totalParticipants = p.participations?.length ?? 0;
      const options = Array.isArray(p.options) ? p.options : [];
      const maxVotes = options.reduce(
        (max: number, o: any) => Math.max(max, o.voteCount ?? 0),
        0
      );
      const topOptions =
        maxVotes > 0
          ? options.filter((o: any) => (o.voteCount ?? 0) === maxVotes)
          : [];

      let outcomeLabel = 'No votes cast';
      if (maxVotes > 0) {
        if (p.status === 'ACTIVE') {
          outcomeLabel =
            topOptions.length > 1
              ? `Tied lead: ${topOptions.map((o: any) => `*${o.text}*`).join(', ')} (${maxVotes})`
              : `Leading: *${topOptions[0].text}* (${maxVotes})`;
        } else {
          outcomeLabel =
            topOptions.length > 1
              ? `Tie: ${topOptions.map((o: any) => `*${o.text}*`).join(', ')} (${maxVotes})`
              : `Winner: *${topOptions[0].text}* (${maxVotes})`;
        }
      }

      const statusLabel = formatStatusLabel(p.status);
      const ballotMode = p.isAnonymous ? 'Anonymous' : 'Public';

      const optionLines = options.map((opt: any, idx: number) => {
        const count = opt.voteCount ?? 0;
        const pct = totalParticipants > 0 ? (count / totalParticipants) * 100 : 0;
        const bar = renderProgressBar(pct, 10);
        let line = `${idx + 1}. *${opt.text}* • \`${bar}\` (${count})`;

        if (!p.isAnonymous && Array.isArray(p.publicVotes) && p.publicVotes.length > 0) {
          const voters = p.publicVotes.filter((v: any) => v.optionId === opt.id);
          if (voters.length > 0) {
            const mentions = voters
              .slice(0, 10)
              .map((v: any) => `<@${v.voterId}>`)
              .join(' ');
            const extra = voters.length - 10;
            line += `\n   ${extra > 0 ? `${mentions} +${extra} more` : mentions}`;
          }
        }
        return line;
      });

      const pollBody = [
        `*${String(p.question ?? 'Untitled Poll').slice(0, 140)}*`,
        `Channel: <#${p.channelId}> • *${statusLabel}* • *${ballotMode}* • *${totalParticipants}* participants • ${outcomeLabel}`,
        ...optionLines,
      ].join('\n');

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: pollBody.slice(0, 2950),
        },
      });
    }
  }

  return {
    type: 'modal',
    title: {
      type: 'plain_text',
      text: 'Poll Results & Analytics',
      emoji: true,
    },
    close: {
      type: 'plain_text',
      text: 'Close',
      emoji: true,
    },
    blocks: blocks.slice(0, 98),
  };
}

export function buildPollDetailModalView(poll: any): ModalView {
  const totalParticipants = poll.participations?.length ?? 0;
  const statusLabel = formatStatusLabel(poll.status);
  const ballotMode = poll.isAnonymous ? 'Anonymous (Double-Urn)' : 'Public';
  const choiceMode = poll.allowMultipleVotes ? 'Multiple choice' : 'Single choice';

  const options = Array.isArray(poll.options) ? poll.options : [];
  const maxVotes = options.reduce(
    (max: number, o: any) => Math.max(max, o.voteCount ?? 0),
    0
  );
  const topOptions =
    maxVotes > 0
      ? options.filter((o: any) => (o.voteCount ?? 0) === maxVotes)
      : [];

  let outcomeLabel = 'No votes cast';
  if (maxVotes > 0) {
    if (poll.status === 'ACTIVE') {
      outcomeLabel =
        topOptions.length > 1
          ? `Tied lead: ${topOptions.map((o: any) => `*${o.text}*`).join(', ')} (${maxVotes})`
          : `Leading: *${topOptions[0].text}* (${maxVotes})`;
    } else {
      outcomeLabel =
        topOptions.length > 1
          ? `Tie: ${topOptions.map((o: any) => `*${o.text}*`).join(', ')} (${maxVotes})`
          : `Winner: *${topOptions[0].text}* (${maxVotes})`;
    }
  }

  let quorumSummary = 'No quorum required';
  if (poll.quorumType === 'PERCENTAGE' && poll.eligibleVoterCount > 0) {
    const achievedPct = Math.round(
      (totalParticipants / poll.eligibleVoterCount) * 100
    );
    quorumSummary = `Target: ${poll.quorumTarget}% • Achieved: ${achievedPct}% (${totalParticipants}/${poll.eligibleVoterCount} members)`;
  } else if (poll.quorumType === 'PERCENTAGE') {
    quorumSummary = `Target: ${poll.quorumTarget}% • Participants: ${totalParticipants}`;
  }

  const blocks: (Block | KnownBlock)[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: String(poll.question ?? 'Poll Results').slice(0, 150),
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Channel*\n<#${poll.channelId}>`,
        },
        {
          type: 'mrkdwn',
          text: `*Status & Outcome*\n${statusLabel} • ${outcomeLabel}`,
        },
        {
          type: 'mrkdwn',
          text: `*Ballot Mode*\n${ballotMode} • ${choiceMode}`,
        },
        {
          type: 'mrkdwn',
          text: `*Quorum & Turnout*\n${quorumSummary}`,
        },
      ],
    },
    {
      type: 'divider',
    },
  ];
  options.forEach((opt: any, idx: number) => {
    const count = opt.voteCount ?? 0;
    const pct = totalParticipants > 0 ? (count / totalParticipants) * 100 : 0;
    const bar = renderProgressBar(pct, 10);

    let text = `*${idx + 1}. ${opt.text}*\n\`${bar}\` • *${count}* ${count === 1 ? 'vote' : 'votes'}`;

    if (
      !poll.isAnonymous &&
      Array.isArray(poll.publicVotes) &&
      poll.publicVotes.length > 0
    ) {
      const voters = poll.publicVotes.filter((v: any) => v.optionId === opt.id);
      if (voters.length > 0) {
        const mentions = voters
          .slice(0, 15)
          .map((v: any) => `<@${v.voterId}>`)
          .join(' ');
        const extra = voters.length - 15;
        text += `\n${extra > 0 ? `${mentions} +${extra} more` : mentions}`;
      }
    }

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text,
      },
    });
  });

  blocks.push(
    {
      type: 'divider',
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Created by <@${poll.creatorId}> • Poll ID: ${String(poll.id ?? '').slice(-6)}`,
        },
      ],
    }
  );

  return {
    type: 'modal',
    title: {
      type: 'plain_text',
      text: 'Poll Results Breakdown',
      emoji: true,
    },
    close: {
      type: 'plain_text',
      text: 'Close',
      emoji: true,
    },
    blocks: blocks.slice(0, 98),
  };
}
