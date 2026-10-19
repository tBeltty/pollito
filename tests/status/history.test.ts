import { describe, expect, it } from 'vitest';
import {
  applySample,
  buildPublicStatus,
  dayKey,
  emptyState,
  HISTORY_DAYS,
  type Sample,
} from '../../src/status/history.js';

const T0 = Date.UTC(2026, 9, 19, 12, 0, 0);
const MIN = 60_000;
const up = (at: number, startedAt: number | null = T0 - 3_600_000, ms = 40): Sample => ({
  at,
  up: true,
  ms,
  startedAt,
});
const down = (at: number): Sample => ({ at, up: false, ms: null, startedAt: null });

describe('status history', () => {
  it('counts samples per UTC day and averages response time', () => {
    let state = emptyState();
    state = applySample(state, up(T0, undefined, 30));
    state = applySample(state, up(T0 + MIN, undefined, 50));
    const bucket = state.days[dayKey(T0)];
    expect(bucket).toMatchObject({ ok: 2, total: 2, ms: 80, msCount: 2 });
    expect(buildPublicStatus(state, T0 + MIN).responseMs).toBe(40);
  });

  it('records a restart only when the process start time changes', () => {
    let state = applySample(emptyState(), up(T0, 1000));
    state = applySample(state, up(T0 + MIN, 1000));
    expect(state.events).toHaveLength(0);
    state = applySample(state, up(T0 + 2 * MIN, 2000));
    expect(state.events).toEqual([{ type: 'restart', at: 2000 }]);
  });

  it('opens one outage while checks fail and closes it on recovery', () => {
    let state = applySample(emptyState(), up(T0));
    state = applySample(state, down(T0 + MIN));
    state = applySample(state, down(T0 + 2 * MIN));
    expect(state.events.filter((e) => e.type === 'outage')).toHaveLength(1);
    expect(buildPublicStatus(state, T0 + 2 * MIN).state).toBe('outage');

    state = applySample(state, up(T0 + 5 * MIN));
    const outage = state.events.find((e) => e.type === 'outage');
    expect(outage?.end).toBe(T0 + 5 * MIN);
    const published = buildPublicStatus(state, T0 + 5 * MIN);
    expect(published.state).toBe('operational');
    expect(published.events[0]).toMatchObject({ type: 'outage', durationSeconds: 240 });
  });

  it('computes uptime windows and exposes one entry per day for 90 days', () => {
    let state = emptyState();
    for (let i = 0; i < 99; i++) state = applySample(state, up(T0 + i * MIN));
    state = applySample(state, down(T0 + 99 * MIN));
    const published = buildPublicStatus(state, T0 + 99 * MIN);
    expect(published.uptime.d30).toBe(99);
    expect(published.uptime.d90).toBe(99);
    expect(published.days).toHaveLength(HISTORY_DAYS);
    expect(published.days.at(-1)).toEqual({ date: dayKey(T0), uptime: 99 });
    expect(published.days[0].uptime).toBeNull();
  });

  it('prunes days older than the window and caps stored events', () => {
    let state = applySample(emptyState(), up(T0 - 100 * 24 * 3_600_000));
    state = applySample(state, up(T0));
    expect(Object.keys(state.days)).toEqual([dayKey(T0)]);
    for (let i = 0; i < 80; i++) state = applySample(state, i % 2 ? down(T0 + i * MIN) : up(T0 + i * MIN));
    expect(state.events.length).toBeLessThanOrEqual(50);
  });

  it('publishes nothing that identifies the server', () => {
    let state = applySample(emptyState(), up(T0));
    state = applySample(state, up(T0 + MIN, T0 + 30 * 1000));
    const json = JSON.stringify(buildPublicStatus(state, T0 + 2 * MIN));
    expect(json).not.toMatch(/pid|host|127\.0\.0\.1|pm2|version|memory|cpu/i);
    expect(Object.keys(JSON.parse(json)).sort()).toEqual(
      ['days', 'events', 'generatedAt', 'responseMs', 'runningSeconds', 'state', 'uptime']
    );
  });
});

describe('status history when the whole server is down', () => {
  const MIN = 60_000;
  const sample = (at: number): Sample => ({ at, up: true, ms: 40, startedAt: T0 - 3_600_000 });

  it('records the minutes with no samples as a 10 minute outage', () => {
    let state = applySample(emptyState(), sample(T0));
    state = applySample(state, sample(T0 + MIN));
    state = applySample(state, sample(T0 + 12 * MIN));
    const outage = state.events.find((e) => e.type === 'outage');
    expect(outage).toMatchObject({ at: T0 + 2 * MIN, end: T0 + 12 * MIN });
    const published = buildPublicStatus(state, T0 + 12 * MIN);
    expect(published.events[0]).toMatchObject({ type: 'outage', durationSeconds: 600 });
    expect(published.state).toBe('operational');
  });

  it('lowers the day uptime by the missing minutes', () => {
    let state = applySample(emptyState(), sample(T0));
    state = applySample(state, sample(T0 + 10 * MIN));
    const bucket = state.days[dayKey(T0)];
    // two real samples plus nine silent minutes
    expect(bucket.total).toBe(11);
    expect(bucket.ok).toBe(2);
  });

  it('does not invent an outage when monitoring was switched off for more than a week', () => {
    let state = applySample(emptyState(), sample(T0));
    state = applySample(state, sample(T0 + 10 * 24 * 60 * MIN));
    expect(state.events.filter((e) => e.type === 'outage')).toHaveLength(0);
    expect(Object.keys(state.days)).toHaveLength(2);
  });

  it('ignores normal jitter between samples', () => {
    let state = applySample(emptyState(), sample(T0));
    state = applySample(state, sample(T0 + 2 * MIN));
    expect(state.events).toHaveLength(0);
  });

  it('keeps an outage open when the server is still down on the next sample', () => {
    let state = applySample(emptyState(), sample(T0));
    state = applySample(state, { at: T0 + 10 * MIN, up: false, ms: null, startedAt: null });
    expect(state.events.filter((e) => e.type === 'outage')).toHaveLength(1);
    expect(state.events[0].end).toBeUndefined();
    expect(buildPublicStatus(state, T0 + 10 * MIN).state).toBe('outage');
  });
});
