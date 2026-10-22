import type { Block, KnownBlock } from '@slack/web-api';
import type { Poll, PollOption } from '@prisma/client';
import { defaultTranslator, type Translator } from '../../../i18n/index.js';
import { NUDGE_COOLDOWN_HOURS } from '../../../config/limits.js';

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

export interface PollMessageRenderOptions {
  maxNudgeChannelMembers?: number;
  allowVoterChoiceNudges?: boolean;
  /** When true, includes creator-only action buttons (nudge / close) on the rendered card. Defaults to false for shared channel cards. */
  showCreatorActions?: boolean;
  /** Translator for the card language. Defaults to English. */
  translator?: Translator;
}

function buildCreatorActionsBlock(
  poll: Pick<PollWithDetails, 'id' | 'eligibleVoterCount'>,
  options?: PollMessageRenderOptions
): KnownBlock {
  const translator = options?.translator ?? defaultTranslator;
  const { t } = translator;
  const maxNudgeMembers = options?.maxNudgeChannelMembers ?? 50;
  const allowNudges = options?.allowVoterChoiceNudges ?? true;
  const canOfferNudge =
    allowNudges &&
    (poll.eligibleVoterCount <= 0 || poll.eligibleVoterCount <= maxNudgeMembers);

  const actionElements: any[] = [];

  if (canOfferNudge) {
    actionElements.push({
      type: 'button',
      text: {
        type: 'plain_text',
        text: t('poll.nudge.button'),
        emoji: true,
      },
      action_id: 'poll_nudge_click',
      value: JSON.stringify({ pollId: poll.id }),
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
    value: JSON.stringify({ pollId: poll.id }),
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

  return {
    type: 'actions',
    block_id: 'poll_creator_actions',
    elements: actionElements,
  };
}

/**
 * Pure Block Kit builder for ephemeral creator-only controls ("Remind non-voters" and "Close poll").
 * Sent via `chat.postEphemeral` to the poll creator so non-authorized channel members never see "Close poll".
 */
export function buildPollCreatorControlsBlocks(
  poll: Pick<PollWithDetails, 'id' | 'question' | 'status' | 'eligibleVoterCount'>,
  options?: PollMessageRenderOptions
): (Block | KnownBlock)[] {
  const isClosed =
    poll.status === 'QUORUM_REACHED' ||
    poll.status === 'CLOSED' ||
    poll.status === 'TIME_EXPIRED';

  if (isClosed) {
    return [];
  }

  const translator = options?.translator ?? defaultTranslator;
  const { t } = translator;

  return [
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: t('poll.creatorControls.caption', { question: poll.question }),
        },
      ],
    },
    buildCreatorActionsBlock(poll, options),
  ];
}

/**
 * Pure Block Kit message builder for Pollito in-channel and in-thread cards.
 * Text comes from the translator, so the same input always renders the same card.
 */
export function buildPollMessageBlocks(
  poll: PollWithDetails,
  options?: PollMessageRenderOptions
): (Block | KnownBlock)[] {
  const translator = options?.translator ?? defaultTranslator;
  const { t } = translator;
  const totalVotes = poll.participations.length;
  const isClosed =
    poll.status === 'QUORUM_REACHED' ||
    poll.status === 'CLOSED' ||
    poll.status === 'TIME_EXPIRED';

  // Determine status text
  let statusText = t('poll.status.active');

  if (poll.status === 'QUORUM_REACHED') {
    statusText = t('poll.status.quorumReached');
  } else if (poll.status === 'TIME_EXPIRED') {
    statusText = t('poll.status.timeExpired');
  } else if (poll.status === 'CLOSED') {
    statusText = t('poll.status.closed');
  } else if (poll.quorumType !== 'NONE' && poll.eligibleVoterCount > 0) {
    const currentPct = (totalVotes / poll.eligibleVoterCount) * 100;
    if (currentPct >= poll.quorumTarget * 0.7) {
      statusText = t('poll.status.approachingQuorum');
    }
  }

  const ballotLabel = poll.isAnonymous ? t('poll.ballot.anonymous') : t('poll.ballot.public');
  const choiceLabel = poll.allowMultipleVotes ? t('poll.choice.multiple') : t('poll.choice.single');

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
          text: t('poll.context.status', {
            status: statusText,
            ballot: ballotLabel,
            choice: choiceLabel,
          }),
        },
      ],
    },
    {
      type: 'divider',
    },
  ];

  // Render each option row
  const maxVotes = isClosed
    ? poll.options.reduce((max, o) => Math.max(max, o.voteCount), 0)
    : 0;
  const topOptionIds =
    isClosed && maxVotes > 0
      ? poll.options.filter((o) => o.voteCount === maxVotes).map((o) => o.id)
      : [];
  const singleWinnerId = topOptionIds.length === 1 ? topOptionIds[0] : null;

  poll.options.forEach((option) => {
    const optionPct = totalVotes > 0 ? (option.voteCount / totalVotes) * 100 : 0;
    const bar = renderProgressBar(optionPct, 10);
    const winnerMark = singleWinnerId === option.id ? ' 🏆' : '';

    let optionText = `*${option.index + 1}. ${option.text}*${winnerMark}\n\`${bar}\` • ${t('poll.option.votes', { count: option.voteCount })}`;

    if (!poll.isAnonymous && poll.publicVotes && poll.publicVotes.length > 0) {
      const optionVoters = poll.publicVotes.filter((v) => v.optionId === option.id);
      if (optionVoters.length > 0) {
        const visibleMentions = optionVoters
          .slice(0, 15)
          .map((v) => `<@${v.voterId}>`)
          .join(' ');
        const extraCount = optionVoters.length - 15;
        const mentionsLine =
          extraCount > 0
            ? `${visibleMentions} ${t('poll.option.moreVoters', { count: extraCount })}`
            : visibleMentions;
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
            text: t('poll.vote.button', { number: option.index + 1 }),
            emoji: true,
          },
          action_id: `vote_option_${option.id}`,
          value: JSON.stringify({ pollId: poll.id, optionId: option.id }),
          style: 'primary',
        },
      });
    }
  });

  if (!isClosed && options?.showCreatorActions === true) {
    blocks.push(buildCreatorActionsBlock(poll, options));
  }

  // Footer telemetry block
  let quorumReadout = '';
  if (poll.quorumType === 'NONE') {
    quorumReadout = t('poll.footer.participantsNoQuorum', { count: totalVotes });
  } else if (poll.quorumType === 'PERCENTAGE' && poll.eligibleVoterCount > 0) {
    const currentPct = Math.round((totalVotes / poll.eligibleVoterCount) * 100);
    quorumReadout = t('poll.footer.quorumPercent', {
      target: poll.quorumTarget,
      votes: totalVotes,
      eligible: poll.eligibleVoterCount,
      reached: currentPct,
    });
  } else if (poll.quorumType === 'COUNT') {
    quorumReadout = t('poll.footer.quorumCount', {
      target: poll.quorumTarget,
      votes: totalVotes,
    });
  } else {
    quorumReadout = t('poll.footer.participants', { count: totalVotes });
  }

  let deadlineReadout = '';
  if (poll.closesAt) {
    // Slack renders <!date> tokens in each viewer's own locale and timezone.
    const unixSec = Math.floor(poll.closesAt.getTime() / 1000);
    const isoStr = poll.closesAt.toISOString();
    const dateToken = `<!date^${unixSec}^{date_short} {time}|${isoStr}>`;
    deadlineReadout = ` • ${t(isClosed ? 'poll.footer.closed' : 'poll.footer.closes', { date: dateToken })}`;
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
          text: `${quorumReadout}${deadlineReadout} • ${t('poll.footer.meta', {
            creatorId: poll.creatorId,
          })}`,
        },
      ],
    }
  );

  return blocks;
}
