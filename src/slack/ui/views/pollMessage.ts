import type { Block, KnownBlock } from '@slack/web-api';
import type { Poll, PollOption, PublicVote } from '@prisma/client';

export type PollWithDetails = Poll & {
  options: PollOption[];
  participations: { voterId: string }[];
  publicVotes?: PublicVote[];
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
  const isClosed = poll.status === 'QUORUM_REACHED' || poll.status === 'CLOSED';

  // Determine reactive mascot state
  let statusEmoji = '🐣';
  let statusText = 'Poll active';

  if (poll.status === 'QUORUM_REACHED') {
    statusEmoji = '🎉';
    statusText = 'Quorum reached • Closed';
  } else if (poll.status === 'CLOSED') {
    statusEmoji = '🔒';
    statusText = 'Poll closed';
  } else if (poll.eligibleVoterCount > 0) {
    const currentPct = (totalVotes / poll.eligibleVoterCount) * 100;
    if (currentPct >= (poll.quorumTarget * 0.7)) {
      statusEmoji = '🧐';
      statusText = 'Approaching quorum target';
    }
  }

  const blocks: (Block | KnownBlock)[] = [
    // Header block
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${statusEmoji} ${poll.question}`,
        emoji: true,
      },
    },
    // Status & quorum badge
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `*Status:* ${statusText} • *Type:* ${poll.isAnonymous ? '🔒 Anonymous ballot' : '👥 Public vote'}`,
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

    const optionText = `*${option.index + 1}. ${option.text}*\n\`${bar}\` • *${option.voteCount}* ${option.voteCount === 1 ? 'vote' : 'votes'}`;

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

  blocks.push(
    {
      type: 'divider',
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `📊 ${quorumReadout} • Created by <@${poll.creatorId}>`,
        },
      ],
    }
  );

  return blocks;
}
