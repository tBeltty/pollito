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
  let maxVotes = 0;
  let winnerText = poll.options[0]?.text ?? 'None';

  for (const opt of poll.options) {
    if (opt.voteCount > maxVotes) {
      maxVotes = opt.voteCount;
      winnerText = opt.text;
    }
  }

  const pCount = poll.participations.length;
  const pWord = pCount === 1 ? 'participant' : 'participants';
  const vWord = maxVotes === 1 ? 'vote' : 'votes';

  if (reason === 'QUORUM_REACHED') {
    return `🎉 *Quorum Reached — Poll Closed*\n\n*${poll.question}* reached its target quorum with *${pCount}* ${pWord}. Leading choice: *${winnerText}* (${maxVotes} ${vWord}).`;
  }

  if (reason === 'CLOSED') {
    return maxVotes > 0
      ? `🔒 *Poll Closed by Creator*\n\n*${poll.question}* is now closed with *${pCount}* total ${pWord}. Leading choice: *${winnerText}* (${maxVotes} ${vWord}).`
      : `🔒 *Poll Closed by Creator*\n\n*${poll.question}* was closed with 0 votes cast.`;
  }

  // TIME_EXPIRED
  return maxVotes > 0
    ? `⏰ *Poll Closed — Time Expired*\n\n*${poll.question}* concluded with *${pCount}* total ${pWord}. Leading choice: *${winnerText}* (${maxVotes} ${vWord}).`
    : `⏰ *Poll Closed — Time Expired*\n\n*${poll.question}* concluded with 0 votes cast.`;
}
