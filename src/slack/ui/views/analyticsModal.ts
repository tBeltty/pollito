import type { Block, KnownBlock, ModalView } from '@slack/web-api';
import { defaultTranslator, type Translator } from '../../../i18n/index.js';
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

export function formatStatusLabel(
  status: string | undefined,
  translator: Translator = defaultTranslator
): string {
  if (status === 'QUORUM_REACHED') return translator.t('status.quorumReached');
  if (status === 'ACTIVE') return translator.t('status.active');
  if (status === 'TIME_EXPIRED') return translator.t('status.timeExpired');
  return translator.t('status.closed');
}

function formatOutcomeLabel(
  options: any[],
  status: string | undefined,
  translator: Translator
): string {
  const { t } = translator;
  const maxVotes = options.reduce((max: number, o: any) => Math.max(max, o.voteCount ?? 0), 0);
  if (maxVotes === 0) return t('analytics.outcome.none');

  const topOptions = options.filter((o: any) => (o.voteCount ?? 0) === maxVotes);
  const isTie = topOptions.length > 1;
  const names = translator.formatList(topOptions.map((o: any) => `*${o.text}*`));

  if (status === 'ACTIVE') {
    return isTie
      ? t('analytics.outcome.tiedLead', { options: names, votes: maxVotes })
      : t('analytics.outcome.leading', { option: topOptions[0].text, votes: maxVotes });
  }
  return isTie
    ? t('analytics.outcome.tie', { options: names, votes: maxVotes })
    : t('analytics.outcome.winner', { option: topOptions[0].text, votes: maxVotes });
}

export function buildAnalyticsModalView(
  stats: AnalyticsModalStats,
  days = 30,
  translator: Translator = defaultTranslator
): ModalView {
  const { t } = translator;
  const scopeText = t(
    stats.scope === 'personal' ? 'analytics.scope.personal' : 'analytics.scope.workspace',
    { days }
  );

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
          text: t('analytics.metric.quorum', {
            rate: stats.quorumComplianceRate,
            count: stats.totalQuorumsReached,
          }),
        },
        {
          type: 'mrkdwn',
          text: t('analytics.metric.participation', { pct: stats.avgParticipationPct }),
        },
        {
          type: 'mrkdwn',
          text: t('analytics.metric.ballots', {
            votes: stats.totalBallotsCast,
            polls: stats.totalPolls,
          }),
        },
        {
          type: 'mrkdwn',
          text: t('analytics.metric.privacy', {
            publicCount: stats.publicPollsCount,
            anonymousCount: stats.anonymousPollsCount,
          }),
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
            text: t('analytics.export.button'),
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
        text: t('analytics.recent.header'),
      },
    },
  ];

  if (!stats.polls || stats.polls.length === 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: t('analytics.empty'),
      },
    });
  } else {
    for (const p of stats.polls.slice(0, 10)) {
      const totalParticipants = p.participations?.length ?? 0;
      const options = Array.isArray(p.options) ? p.options : [];
      const outcomeLabel = formatOutcomeLabel(options, p.status, translator);
      const statusLabel = formatStatusLabel(p.status, translator);
      const ballotMode = p.isAnonymous ? t('common.anonymous') : t('common.public');

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
            line += `\n   ${extra > 0 ? `${mentions} ${t('poll.option.moreVoters', { count: extra })}` : mentions}`;
          }
        }
        return line;
      });

      const pollBody = [
        `*${String(p.question ?? t('common.untitledPoll')).slice(0, 140)}*`,
        t('analytics.poll.summary', {
          channelId: p.channelId,
          status: statusLabel,
          mode: ballotMode,
          participants: totalParticipants,
          outcome: outcomeLabel,
        }),
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
      text: t('analytics.title'),
      emoji: true,
    },
    close: {
      type: 'plain_text',
      text: t('common.close'),
      emoji: true,
    },
    blocks: blocks.slice(0, 98),
  };
}

export function buildPollDetailModalView(
  poll: any,
  translator: Translator = defaultTranslator
): ModalView {
  const { t } = translator;
  const totalParticipants = poll.participations?.length ?? 0;
  const statusLabel = formatStatusLabel(poll.status, translator);
  const ballotMode = poll.isAnonymous ? t('detail.mode.anonymous') : t('common.public');
  const choiceMode = poll.allowMultipleVotes
    ? t('poll.choice.multiple')
    : t('poll.choice.single');

  const options = Array.isArray(poll.options) ? poll.options : [];
  const outcomeLabel = formatOutcomeLabel(options, poll.status, translator);

  let quorumSummary = t('detail.quorum.none');
  if (poll.quorumType === 'PERCENTAGE' && poll.eligibleVoterCount > 0) {
    const achievedPct = Math.round((totalParticipants / poll.eligibleVoterCount) * 100);
    quorumSummary = t('detail.quorum.full', {
      target: poll.quorumTarget,
      achieved: achievedPct,
      votes: totalParticipants,
      eligible: poll.eligibleVoterCount,
    });
  } else if (poll.quorumType === 'PERCENTAGE') {
    quorumSummary = t('detail.quorum.partial', {
      target: poll.quorumTarget,
      count: totalParticipants,
    });
  }

  const blocks: (Block | KnownBlock)[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: String(poll.question ?? t('detail.fallbackQuestion')).slice(0, 150),
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: t('detail.field.channel', { channelId: poll.channelId }),
        },
        {
          type: 'mrkdwn',
          text: t('detail.field.status', { status: statusLabel, outcome: outcomeLabel }),
        },
        {
          type: 'mrkdwn',
          text: t('detail.field.ballot', { mode: ballotMode, choice: choiceMode }),
        },
        {
          type: 'mrkdwn',
          text: t('detail.field.quorum', { summary: quorumSummary }),
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

    let text = `*${idx + 1}. ${opt.text}*\n\`${bar}\` • ${t('poll.option.votes', { count })}`;

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
        text += `\n${extra > 0 ? `${mentions} ${t('poll.option.moreVoters', { count: extra })}` : mentions}`;
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
          text: t('detail.footer', {
            creatorId: poll.creatorId,
            pollId: String(poll.id ?? '').slice(-6),
          }),
        },
      ],
    }
  );

  return {
    type: 'modal',
    title: {
      type: 'plain_text',
      text: t('detail.title'),
      emoji: true,
    },
    close: {
      type: 'plain_text',
      text: t('common.close'),
      emoji: true,
    },
    blocks: blocks.slice(0, 98),
  };
}
