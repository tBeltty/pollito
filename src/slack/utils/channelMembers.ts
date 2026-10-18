import type { WebClient } from '@slack/web-api';

const botUserCache = new WeakMap<object, string>();

/**
 * Fetches eligible human channel members, excluding the bot itself and paginating up to 5 pages.
 */
export async function getEligibleChannelMembers(
  client: WebClient,
  channelId: string
): Promise<string[]> {
  try {
    let botUserId: string | undefined = botUserCache.get(client as object);
    if (!botUserId && client.auth?.test) {
      const auth = await client.auth.test().catch(() => ({ user_id: undefined }));
      if (auth?.user_id) {
        botUserId = auth.user_id;
        botUserCache.set(client as object, botUserId);
      }
    }

    const members: string[] = [];
    let cursor: string | undefined = undefined;

    for (let page = 0; page < 5; page++) {
      const res = await client.conversations.members({
        channel: channelId,
        limit: 200,
        cursor,
      });

      if (res?.members && Array.isArray(res.members)) {
        members.push(...res.members);
      }

      cursor = res?.response_metadata?.next_cursor;
      if (!cursor) break;
    }

    const uniqueMembers = Array.from(new Set(members));
    return botUserId ? uniqueMembers.filter((id) => id !== botUserId) : uniqueMembers;
  } catch {
    return [];
  }
}

import { defaultTranslator, type Translator } from '../../i18n/index.js';

export interface PollClosureSummaryData {
  question: string;
  options: { text: string; voteCount: number }[];
  participations: { voterId: string }[];
}

/**
 * Formats a clean thread closure announcement using the poll's locale translator.
 */
export function formatPollClosureSummary(
  poll: PollClosureSummaryData,
  reason: 'QUORUM_REACHED' | 'CLOSED' | 'TIME_EXPIRED',
  options?: { translator?: Translator }
): string {
  const translator = options?.translator ?? defaultTranslator;
  const { t } = translator;

  const maxVotes = poll.options.reduce((max, opt) => Math.max(max, opt.voteCount), 0);
  const topOptions =
    maxVotes > 0 ? poll.options.filter((opt) => opt.voteCount === maxVotes) : [];
  const pCount = poll.participations.length;

  let outcomeClause = '';
  if (topOptions.length === 1) {
    outcomeClause = t('closure.outcome.winner', {
      option: topOptions[0].text,
      votes: maxVotes,
    });
  } else if (topOptions.length > 1) {
    const formattedList = topOptions.map((o) => `*${o.text}*`).join(', ');
    outcomeClause = t('closure.outcome.tie', {
      options: formattedList,
      votes: maxVotes,
    });
  }

  let title = '';
  let body = '';

  if (reason === 'QUORUM_REACHED') {
    title = t('closure.title.quorum');
    body = t('closure.body.quorum', { question: poll.question, count: pCount });
  } else if (reason === 'CLOSED') {
    title = t('closure.title.closed');
    body =
      maxVotes > 0
        ? t('closure.body.closed', { question: poll.question, count: pCount })
        : t('closure.body.closedEmpty', { question: poll.question });
  } else {
    // TIME_EXPIRED
    title = t('closure.title.expired');
    body =
      maxVotes > 0
        ? t('closure.body.expired', { question: poll.question, count: pCount })
        : t('closure.body.expiredEmpty', { question: poll.question });
  }

  return outcomeClause ? `${title}\n\n${body} ${outcomeClause}` : `${title}\n\n${body}`;
}
