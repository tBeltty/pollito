/**
 * Pure state machine behind the public status page. It turns one-minute health samples
 * into daily buckets, restart events, and outage events, and then into a document that is
 * safe to publish: no hostnames, process ids, versions, or resource figures.
 */

export const HISTORY_DAYS = 90;
const MAX_EVENTS = 50;
const PUBLIC_EVENTS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
/** The probe runs once a minute. */
export const SAMPLE_MS = 60 * 1000;
/**
 * If more than this passes between two samples, the probe was not running (the whole server
 * was down or rebooting). The missing minutes count as downtime.
 */
export const GAP_MS = 150 * 1000;
/**
 * Gaps longer than this are treated as monitoring being switched off, not as an outage, so a
 * probe that was removed for a while cannot invent days of downtime.
 */
export const MAX_GAP_MS = 7 * DAY_MS;

export interface DayBucket {
  ok: number;
  total: number;
  /** Sum of response times of successful checks, in milliseconds. */
  ms: number;
  /** Number of successful checks that contributed to `ms`. */
  msCount: number;
}

export interface StatusEvent {
  type: 'restart' | 'outage';
  /** Epoch milliseconds. */
  at: number;
  /** Epoch milliseconds, set once an outage has ended. */
  end?: number;
}

export interface HistoryState {
  version: 1;
  days: Record<string, DayBucket>;
  events: StatusEvent[];
  lastStartedAt: number | null;
  lastUp: boolean | null;
  lastSampleAt?: number | null;
}

export interface Sample {
  at: number;
  up: boolean;
  ms: number | null;
  /** Epoch milliseconds when the current process started, if known. */
  startedAt: number | null;
}

export interface PublicStatus {
  generatedAt: string;
  state: 'operational' | 'outage' | 'unknown';
  runningSeconds: number | null;
  responseMs: number | null;
  uptime: { d30: number | null; d90: number | null };
  days: { date: string; uptime: number | null }[];
  events: { type: 'restart' | 'outage'; at: string; durationSeconds?: number }[];
}

export function emptyState(): HistoryState {
  return { version: 1, days: {}, events: [], lastStartedAt: null, lastUp: null, lastSampleAt: null };
}

export function dayKey(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

export function applySample(previous: HistoryState, sample: Sample): HistoryState {
  const state: HistoryState = {
    ...previous,
    days: { ...previous.days },
    events: previous.events.map((e) => ({ ...e })),
  };

  // The probe itself was not running for a while: count the missing minutes as downtime.
  const lastSampleAt = previous.lastSampleAt ?? null;
  if (lastSampleAt !== null && sample.at - lastSampleAt > GAP_MS && sample.at - lastSampleAt <= MAX_GAP_MS) {
    const missedFrom = lastSampleAt + SAMPLE_MS;
    for (let t = missedFrom; t < sample.at; t += SAMPLE_MS) {
      const missedKey = dayKey(t);
      const missed = { ...(state.days[missedKey] ?? { ok: 0, total: 0, ms: 0, msCount: 0 }) };
      missed.total += 1;
      state.days[missedKey] = missed;
    }
    if (state.lastUp !== false) {
      state.events.push({ type: 'outage', at: missedFrom });
      state.lastUp = false;
    }
  }
  state.lastSampleAt = sample.at;

  const key = dayKey(sample.at);
  const bucket = { ...(state.days[key] ?? { ok: 0, total: 0, ms: 0, msCount: 0 }) };
  bucket.total += 1;
  if (sample.up) {
    bucket.ok += 1;
    if (sample.ms !== null) {
      bucket.ms += sample.ms;
      bucket.msCount += 1;
    }
  }
  state.days[key] = bucket;

  if (
    sample.startedAt !== null &&
    state.lastStartedAt !== null &&
    sample.startedAt !== state.lastStartedAt
  ) {
    state.events.push({ type: 'restart', at: sample.startedAt });
  }
  if (sample.startedAt !== null) {
    state.lastStartedAt = sample.startedAt;
  }

  if (!sample.up && state.lastUp !== false) {
    state.events.push({ type: 'outage', at: sample.at });
  } else if (sample.up && state.lastUp === false) {
    for (let i = state.events.length - 1; i >= 0; i--) {
      const event = state.events[i];
      if (event.type === 'outage' && event.end === undefined) {
        event.end = sample.at;
        break;
      }
    }
  }
  state.lastUp = sample.up;

  const keepFrom = dayKey(sample.at - (HISTORY_DAYS - 1) * DAY_MS);
  for (const date of Object.keys(state.days)) {
    if (date < keepFrom) delete state.days[date];
  }
  state.events.sort((a, b) => a.at - b.at);
  state.events = state.events.slice(-MAX_EVENTS);

  return state;
}

function percent(ok: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((ok / total) * 10000) / 100;
}

function windowUptime(state: HistoryState, now: number, days: number): number | null {
  let ok = 0;
  let total = 0;
  for (let i = 0; i < days; i++) {
    const bucket = state.days[dayKey(now - i * DAY_MS)];
    if (bucket) {
      ok += bucket.ok;
      total += bucket.total;
    }
  }
  return percent(ok, total);
}

export function buildPublicStatus(state: HistoryState, now: number): PublicStatus {
  const days: PublicStatus['days'] = [];
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const date = dayKey(now - i * DAY_MS);
    const bucket = state.days[date];
    days.push({ date, uptime: bucket ? percent(bucket.ok, bucket.total) : null });
  }

  let ms = 0;
  let msCount = 0;
  for (let i = 0; i < 2; i++) {
    const bucket = state.days[dayKey(now - i * DAY_MS)];
    if (bucket) {
      ms += bucket.ms;
      msCount += bucket.msCount;
    }
  }

  const up = state.lastUp;
  const events = [...state.events]
    .reverse()
    .slice(0, PUBLIC_EVENTS)
    .map((event) => ({
      type: event.type,
      at: new Date(event.at).toISOString(),
      ...(event.end !== undefined
        ? { durationSeconds: Math.max(0, Math.round((event.end - event.at) / 1000)) }
        : {}),
    }));

  return {
    generatedAt: new Date(now).toISOString(),
    state: up === null ? 'unknown' : up ? 'operational' : 'outage',
    runningSeconds:
      up && state.lastStartedAt !== null
        ? Math.max(0, Math.floor((now - state.lastStartedAt) / 1000))
        : null,
    responseMs: msCount > 0 ? Math.round(ms / msCount) : null,
    uptime: { d30: windowUptime(state, now, 30), d90: windowUptime(state, now, 90) },
    days,
    events,
  };
}
