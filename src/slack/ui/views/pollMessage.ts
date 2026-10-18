import type { Block, KnownBlock } from '@slack/web-api';
import type { Poll, PollOption } from '@prisma/client';

export type PollWithDetails = Omit<Poll, 'allowMultipleVotes'> & {
  allowMultipleVotes?: boolean;
  options: PollOption[];
  participations: { voterId: string }[];
  publicVotes?: { voterId: string; optionId: string }[];
};

/**
 * Builds clean text character progress bar for Slack Block Kit.
 * Example: [████████░░░░] 67%
 */
export function renderProgressBar(percentage: number, totalSlots = 10): string {
  const safePct = Math.max(0, Math.min(100, Math.round(percentage)));
  const filledSlots = Math.round((safePct / 100) * totalSlots);
  const emptySlots = totalSlots - filledSlots;

  const filledChar = '█';
  const emptyChar = '░';

  return `${filledChar.repeat(filledSlots)}${emptyChar.repeat(emptySlots)} ${safePct}%`;
}

/**
 * Pure Block Kit message builder for Pollito in-channel and in-thread cards.
 */
export function buildPollMessageBlocks(poll: PollWithDetails): (Block | KnownBlock)[] {
  const totalVotes = poll.participations.length;
  const isClosed =
    poll.status === 'QUORUM_REACHED' ||
    poll.status === 'CLOSED' ||
    poll.status === 'TIME_EXPIRED';

  // Determine Pollito mascot micro-expression
  let mascot = '🐣';
  if (poll.status === 'QUORUM_REACHED') {
    mascot = '🎉';
  } else if (poll.status === 'TIME_EXPIRED' || poll.status === 'CLOSED') {
    mascot = '⏰';
  } else if (totalVotes > 0) {
    mascot = '🧐';
  }

  // Determine status text
  let statusText = 'Poll active';

  if (poll.status === 'QUORUM_REACHED') {
    statusText = 'Quorum reached • Closed';
  } else if (poll.status === 'TIME_EXPIRED') {
    statusText = 'Time limit reached • Closed';
  } else if (poll.status === 'CLOSED') {
    statusText = 'Poll closed';
  } else if (poll.eligibleVoterCount > 0) {
    const currentPct = (totalVotes / poll.eligibleVoterCount) * 100;
    if (currentPct >= poll.quorumTarget * 0.7) {
      statusText = 'Approaching quorum target';
    }
  }

  const ballotLabel = poll.isAnonymous ? 'Anonymous ballot' : 'Public vote';
  const choiceLabel = poll.allowMultipleVotes ? 'Multiple choice' : 'Single choice';

  const blocks: (Block | KnownBlock)[] = [
    // Header block (defensively truncated to Slack's 150-char plain_text limit)
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: poll.question.slice(0, 150),
      },
    },
    // Status & quorum badge
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `${mascot} *Status:* ${statusText} • *Type:* ${ballotLabel} • ${choiceLabel}`,
        },
      ],
    },
    {
      type: 'divider',
    },
  ];

  // Render each option row
  poll.options.forEach((option) => {
    const optionPct = totalVotes > 0 ? (option.voteCount / totalVotes) * 100 : 0;
    const bar = renderProgressBar(optionPct, 10);

    let optionText = `*${option.index + 1}. ${option.text}*\n\`${bar}\` • *${option.voteCount}* ${option.voteCount === 1 ? 'vote' : 'votes'}`;

    if (!poll.isAnonymous && poll.publicVotes && poll.publicVotes.length > 0) {
      const optionVoters = poll.publicVotes.filter((v) => v.optionId === option.id);
      if (optionVoters.length > 0) {
        const visibleMentions = optionVoters
          .slice(0, 15)
          .map((v) => `<@${v.voterId}>`)
          .join(' ');
        const extraCount = optionVoters.length - 15;
        const mentionsLine =
          extraCount > 0 ? `${visibleMentions} +${extraCount} more` : visibleMentions;
        optionText += `\n${mentionsLine}`;
      }
    }

    if (isClosed) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: optionText,
        },
      });
    } else {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: optionText,
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: `Vote ${option.index + 1}`,
            emoji: true,
          },
          action_id: `vote_option_${option.id}`,
          value: JSON.stringify({ pollId: poll.id, optionId: option.id }),
          style: 'primary',
        },
      });
    }
  });

  if (!isClosed) {
    blocks.push({
      type: 'actions',
      block_id: 'poll_creator_actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Nudge Non-Voters',
            emoji: true,
          },
          action_id: 'poll_nudge_click',
          value: JSON.stringify({ pollId: poll.id }),
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Close Poll',
            emoji: true,
          },
          action_id: 'poll_close_click',
          value: JSON.stringify({ pollId: poll.id }),
          style: 'danger',
        },
      ],
    });
  }

  // Footer telemetry block
  let quorumReadout = '';
  if (poll.quorumType === 'PERCENTAGE' && poll.eligibleVoterCount > 0) {
    const currentPct = Math.round((totalVotes / poll.eligibleVoterCount) * 100);
    quorumReadout = `Quorum target: ${poll.quorumTarget}% (${totalVotes}/${poll.eligibleVoterCount} members • ${currentPct}% reached)`;
  } else if (poll.quorumType === 'COUNT') {
    quorumReadout = `Quorum target: ${poll.quorumTarget} votes (${totalVotes}/${poll.quorumTarget} reached)`;
  } else {
    quorumReadout = `Total participants: ${totalVotes}`;
  }

  let deadlineReadout = '';
  if (poll.closesAt) {
    const unixSec = Math.floor(poll.closesAt.getTime() / 1000);
    const isoStr = poll.closesAt.toISOString();
    deadlineReadout = isClosed
      ? ` • Closed: <!date^${unixSec}^{date_short} {time}|${isoStr}>`
      : ` • Closes: <!date^${unixSec}^{date_short} {time}|${isoStr}>`;
  }

  blocks.push(
    {
      type: 'divider',
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `${quorumReadout}${deadlineReadout} • Created by <@${poll.creatorId}> • ID: ${poll.id.slice(-6)}`,
        },
      ],
    }
  );

  return blocks;
}
