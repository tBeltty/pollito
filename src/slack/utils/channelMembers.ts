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

export interface PollClosureSummaryData {
  question: string;
  options: { text: string; voteCount: number }[];
  participations: { voterId: string }[];
}

/**
 * Formats a clean English thread closure announcement without AI slop.
 */
export function formatPollClosureSummary(
  poll: PollClosureSummaryData,
  reason: 'QUORUM_REACHED' | 'CLOSED' | 'TIME_EXPIRED'
): string {
  const maxVotes = poll.options.reduce((max, opt) => Math.max(max, opt.voteCount), 0);
  const topOptions =
    maxVotes > 0 ? poll.options.filter((opt) => opt.voteCount === maxVotes) : [];

  const pCount = poll.participations.length;
  const pWord = pCount === 1 ? 'participant' : 'participants';
  const vWord = maxVotes === 1 ? 'vote' : 'votes';

  const outcomeClause =
    topOptions.length === 1
      ? `Winner: *${topOptions[0].text}* (${maxVotes} ${vWord}).`
      : topOptions.length > 1
        ? `Result: Tie between ${topOptions.map((o) => `*${o.text}*`).join(', ')} (${maxVotes} ${vWord} each).`
        : '';

  if (reason === 'QUORUM_REACHED') {
    return maxVotes > 0
      ? `🎉 *Quorum Reached — Poll Closed*\n\n*${poll.question}* reached its target quorum with *${pCount}* ${pWord}. ${outcomeClause}`
      : `🎉 *Quorum Reached — Poll Closed*\n\n*${poll.question}* reached its target quorum with *${pCount}* ${pWord}.`;
  }

  if (reason === 'CLOSED') {
    return maxVotes > 0
      ? `🔒 *Poll Closed by Creator*\n\n*${poll.question}* is now closed with *${pCount}* total ${pWord}. ${outcomeClause}`
      : `🔒 *Poll Closed by Creator*\n\n*${poll.question}* was closed with 0 votes cast.`;
  }

  // TIME_EXPIRED
  return maxVotes > 0
    ? `⏰ *Poll Closed — Time Expired*\n\n*${poll.question}* concluded with *${pCount}* total ${pWord}. ${outcomeClause}`
    : `⏰ *Poll Closed — Time Expired*\n\n*${poll.question}* concluded with 0 votes cast.`;
}
