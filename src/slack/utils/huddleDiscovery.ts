export interface DetectedHuddle {
  ts: string;
  isActive: boolean;
  startedAt?: Date;
  timeFormatted: string;
  createdBy?: string;
  roomName?: string;
}

// Live in-memory cache of active Huddle thread root timestamps per channel (populated by message events)
const liveActiveHuddleByChannel = new Map<string, string>();

export function recordHuddleMessageEvent(event: any): void {
  if (!event || typeof event !== 'object') return;
  const msg = event.message || event;
  const channelId = String(event.channel || msg.channel || '').trim();
  if (!channelId || !isHuddleMessage(msg)) return;

  const rootTs = String(msg.thread_ts || msg.ts || event.ts || '').trim();
  if (!rootTs) return;

  if (isHuddleEnded(msg)) {
    if (liveActiveHuddleByChannel.get(channelId) === rootTs) {
      liveActiveHuddleByChannel.delete(channelId);
    }
  } else {
    liveActiveHuddleByChannel.set(channelId, rootTs);
  }
}

export function getCachedActiveHuddleThread(channelId: string): string | null {
  return liveActiveHuddleByChannel.get(channelId) ?? null;
}

const HUDDLE_SUBTYPES = new Set([
  'huddle_thread',
  'sh_room_created',
  'channel_huddle',
  'room_topic',
]);

const HUDDLE_ACTION_PATTERNS = [
  /\b(?:started|inici(?:ó|ado)|commencé|begonnen)\s+(?:a\s+|un\s+)?(?:huddle|call|llamada)\b/i,
  /\b(?:joined|se\s+uni[oó])\s+(?:the\s+|a\s+|al\s+)?huddle\b/i,
  /\b(?:huddle|call|llamada)\s+(?:started|inici(?:ó|ado)|begonnen|commencé)\b/i,
  /\b(?:huddle|call|llamada)\s+(?:ended|finaliz(?:ó|ado)|termin(?:ó|ado)|beendet|terminé)\b/i,
  /\b(?:ended|finaliz(?:ó|ado)|termin(?:ó|ado))\s+(?:a\s+|the\s+|un\s+|el\s+)?(?:huddle|call|llamada)\b/i,
  /\bhuddle\s+is\s+live\b/i,
];

const HUDDLE_ENDED_KEYWORDS = [
  'huddle ended',
  'ended a huddle',
  'ended the huddle',
  'call ended',
  'ended the call',
  'huddle finalizado',
  'finalizó el huddle',
  'finalizó un huddle',
  'terminó el huddle',
  'terminó un huddle',
  'llamada finalizada',
  'huddle terminé',
  'huddle beendet',
];

/**
 * Determines whether a Slack message payload represents a Huddle event or thread root.
 * Rejects bot and app messages so regular bot notifications mentioning "huddle" are ignored.
 */
export function isHuddleMessage(msg: any): boolean {
  if (!msg || typeof msg !== 'object') {
    return false;
  }

  if (msg.bot_id || msg.app_id || msg.subtype === 'bot_message') {
    return false;
  }

  const subtype = String(msg.subtype ?? '').toLowerCase();
  if (HUDDLE_SUBTYPES.has(subtype)) {
    return true;
  }

  if (msg.room != null && typeof msg.room === 'object') {
    return true;
  }

  const text = String(msg.text ?? '');
  if (HUDDLE_ACTION_PATTERNS.some((pattern) => pattern.test(text))) {
    return true;
  }

  try {
    const rawJson = JSON.stringify(msg).toLowerCase();
    if (
      rawJson.includes('"subtype":"huddle_thread"') ||
      rawJson.includes('"subtype":"sh_room_created"') ||
      rawJson.includes('"subtype":"channel_huddle"') ||
      rawJson.includes('"room":') ||
      rawJson.includes('huddle is live')
    ) {
      return true;
    }
  } catch {
    // ignore serialization errors
  }

  return false;
}

/**
 * Determines whether a Slack Huddle message indicates that the Huddle has already ended.
 */
export function isHuddleEnded(msg: any): boolean {
  if (!msg || typeof msg !== 'object') {
    return false;
  }

  if (msg.room && typeof msg.room === 'object') {
    if (msg.room.has_ended === true) {
      return true;
    }

    if (typeof msg.room.date_end === 'number' && msg.room.date_end > 0) {
      return true;
    }

    if (
      Array.isArray(msg.room.participants) &&
      msg.room.participants.length === 0 &&
      Array.isArray(msg.room.participant_history) &&
      msg.room.participant_history.length > 0
    ) {
      return true;
    }
  }

  const text = String(msg.text ?? '').toLowerCase();
  if (HUDDLE_ENDED_KEYWORDS.some((phrase) => text.includes(phrase))) {
    return true;
  }

  try {
    const rawJson = JSON.stringify(msg).toLowerCase();
    if (
      rawJson.includes('"has_ended":true') ||
      (rawJson.includes('"date_end":') &&
        !rawJson.includes('"date_end":0') &&
        !rawJson.includes('"date_end":null'))
    ) {
      return true;
    }
  } catch {
    // ignore serialization errors
  }

  return false;
}

function formatHuddleTime(ts: string, dateStart?: number): {
  startedAt?: Date;
  timeFormatted: string;
} {
  const numericTs =
    typeof dateStart === 'number' && dateStart > 0
      ? dateStart
      : Number.parseFloat(ts);

  if (!Number.isFinite(numericTs) || numericTs <= 0) {
    return { timeFormatted: 'Recent huddle' };
  }

  const startedAt = new Date(numericTs * 1000);
  const iso = startedAt.toISOString();
  const timeFormatted = `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;

  return { startedAt, timeFormatted };
}

/**
 * Parses a Slack message link (e.g. `.../archives/C123/p1700000000123456`) or raw `thread_ts` (`1700000000.123456`)
 * into a standard Slack timestamp (`1700000000.123456`), or returns `null` if invalid.
 */
export function parseHuddleThreadInput(raw: string): string | null {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) {
    return null;
  }

  const linkMatch = trimmed.match(/p(\d{10})(\d{6})/);
  if (linkMatch) {
    return `${linkMatch[1]}.${linkMatch[2]}`;
  }

  if (/^\d{10}\.\d{6}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Scans recent channel history to discover active and recently ended Slack Huddles.
 */
export async function findChannelHuddles(
  client: any,
  channelId: string,
  token?: string
): Promise<DetectedHuddle[]> {
  if (!client || !channelId) {
    return [];
  }

  try {
    await client.conversations?.join?.({
      channel: channelId,
      ...(token ? { token } : {}),
    });
  } catch {
    // Safe fallback for private channels, DMs, or channels where bot is already a member
  }

  let messages: any[] = [];
  let historyLoaded = false;
  try {
    const response = await client.conversations?.history?.({
      channel: channelId,
      limit: 50,
      ...(token ? { token } : {}),
    });
    messages = Array.isArray(response?.messages) ? response.messages : [];
    historyLoaded = true;
  } catch {
    const fallbackToken = process.env.SLACK_HUDDLE_DISCOVERY_TOKEN?.trim();
    if (fallbackToken && fallbackToken !== token) {
      try {
        await client.conversations?.join?.({
          channel: channelId,
          token: fallbackToken,
        });
      } catch {
        // Ignore join errors on fallback token
      }
      try {
        const fallbackResponse = await client.conversations?.history?.({
          channel: channelId,
          limit: 50,
          token: fallbackToken,
        });
        messages = Array.isArray(fallbackResponse?.messages)
          ? fallbackResponse.messages
          : [];
        historyLoaded = true;
      } catch {
        historyLoaded = false;
      }
    }
  }

  if (!historyLoaded) {
    const cachedTs = getCachedActiveHuddleThread(channelId);
    if (cachedTs) {
      const { startedAt, timeFormatted } = formatHuddleTime(cachedTs);
      return [{ ts: cachedTs, isActive: true, startedAt, timeFormatted }];
    }
    return [];
  }

  const groupedByRootTs = new Map<string, any[]>();

  for (const msg of messages) {
    if (!isHuddleMessage(msg)) {
      continue;
    }
    const rootTs = String(msg.thread_ts || msg.ts || '').trim();
    if (!rootTs) {
      continue;
    }
    const group = groupedByRootTs.get(rootTs) ?? [];
    group.push(msg);
    groupedByRootTs.set(rootTs, group);
  }

  // Attach any non-huddle-flagged thread messages sharing the same rootTs so end signals are caught
  for (const msg of messages) {
    const rootTs = String(msg?.thread_ts || msg?.ts || '').trim();
    if (rootTs && groupedByRootTs.has(rootTs)) {
      const group = groupedByRootTs.get(rootTs)!;
      if (!group.includes(msg)) {
        group.push(msg);
      }
    }
  }

  const detected: DetectedHuddle[] = [];

  for (const [rootTs, group] of groupedByRootTs.entries()) {
    const ended = group.some((m) => isHuddleEnded(m));
    const rootMsg = group.find((m) => m.ts === rootTs) ?? group[0];
    const roomMsg = group.find((m) => m.room && typeof m.room === 'object');
    const room = roomMsg?.room;

    const { startedAt, timeFormatted } = formatHuddleTime(
      rootTs,
      room?.date_start
    );

    const createdBy =
      typeof room?.created_by === 'string' && room.created_by
        ? room.created_by
        : typeof rootMsg?.user === 'string' && rootMsg.user
          ? rootMsg.user
          : undefined;

    const roomName =
      typeof room?.name === 'string' && room.name.trim().length > 0
        ? room.name.trim()
        : undefined;

    if (!ended) {
      liveActiveHuddleByChannel.set(channelId, rootTs);
    } else if (liveActiveHuddleByChannel.get(channelId) === rootTs) {
      liveActiveHuddleByChannel.delete(channelId);
    }

    detected.push({
      ts: rootTs,
      isActive: !ended,
      startedAt,
      timeFormatted,
      createdBy,
      roomName,
    });
  }

  if (detected.length === 0) {
    const cachedTs = getCachedActiveHuddleThread(channelId);
    if (cachedTs) {
      const { startedAt, timeFormatted } = formatHuddleTime(cachedTs);
      detected.push({ ts: cachedTs, isActive: true, startedAt, timeFormatted });
    }
  }

  return detected;
}

/**
 * Returns the thread timestamp (`ts`) of the first active Huddle in the given channel, or `null` if none is active.
 */
export async function findActiveHuddleThread(
  client: any,
  channelId: string,
  token?: string
): Promise<string | null> {
  const huddles = await findChannelHuddles(client, channelId, token);
  const active = huddles.find((h) => h.isActive);
  return active ? active.ts : null;
}

/**
 * Posts a "Remember to vote" reminder and permalink to the main channel when a Huddle concludes.
 */
export async function notifyMainChannelOnHuddleEnd(
  client: any,
  poll: {
    id: string;
    channelId: string;
    messageTs: string;
    threadTs?: string | null;
    question: string;
  },
  token?: string
): Promise<boolean> {
  const { PollService } = await import('../../services/pollService.js');
  const claimed = await PollService.claimHuddleEndReminder(poll.id);
  if (!claimed) {
    return false;
  }

  let permalink = '';
  try {
    const permRes = await client.chat?.getPermalink?.({
      channel: poll.channelId,
      message_ts: poll.messageTs,
      ...(token ? { token } : {}),
    });
    permalink = permRes?.permalink || '';
  } catch {
    // fallback to reconstructed permalink
  }

  if (!permalink) {
    const cleanedTs = poll.messageTs.replace('.', '');
    permalink = `https://slack.com/archives/${poll.channelId}/p${cleanedTs}${
      poll.threadTs ? `?thread_ts=${poll.threadTs}&cid=${poll.channelId}` : ''
    }`;
  }

  const { getPollTranslator } = await import('./locale.js');
  const translator = getPollTranslator(poll as any);
  const { t } = translator;

  try {
    await client.chat.postMessage({
      ...(token ? { token } : {}),
      channel: poll.channelId,
      unfurl_links: true,
      unfurl_media: true,
      text: t('huddle.reminder.fallback', { question: poll.question, permalink }),
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: t('huddle.reminder.body', { question: poll.question, permalink }),
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: t('huddle.reminder.button'),
              emoji: true,
            },
            url: permalink,
            action_id: 'huddle_reminder_jump_link',
          },
        },
      ],
    });
    return true;
  } catch (err) {
    console.error(
      `Failed to post Huddle-end reminder to channel ${poll.channelId}:`,
      err
    );
    return false;
  }
}
