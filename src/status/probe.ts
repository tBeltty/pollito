import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  applySample,
  buildPublicStatus,
  emptyState,
  type HistoryState,
  type Sample,
} from './history.js';

/**
 * One-minute probe for the public status page. Run it from cron on the server:
 *   * * * * * cd /home/jhonatan/pollito && node dist/status/probe.js
 * It checks the local /healthz endpoint, reads when the PM2 process last started, updates a
 * private history file, and writes a sanitized status.json for nginx to serve.
 */

const execFileAsync = promisify(execFile);

const HEALTH_URL = process.env.STATUS_HEALTH_URL ?? 'http://127.0.0.1:3015/healthz';
const PM2_NAME = process.env.STATUS_PM2_NAME ?? 'pollito';
const DATA_DIR = process.env.STATUS_DATA_DIR ?? path.resolve(process.cwd(), 'data/status');
const TIMEOUT_MS = 5000;

export async function checkHealth(url: string): Promise<{ up: boolean; ms: number | null }> {
  const started = Date.now();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const ms = Date.now() - started;
    if (!response.ok) return { up: false, ms: null };
    const body = (await response.json()) as { status?: unknown };
    return { up: body.status === 'ok', ms };
  } catch {
    return { up: false, ms: null };
  }
}

async function readStartedAt(name: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync('pm2', ['jlist'], { timeout: TIMEOUT_MS });
    const processes = JSON.parse(stdout) as {
      name?: string;
      pm2_env?: { pm_uptime?: number; status?: string };
    }[];
    const match = processes.find((p) => p.name === name);
    const startedAt = match?.pm2_env?.pm_uptime;
    return match?.pm2_env?.status === 'online' && typeof startedAt === 'number'
      ? startedAt
      : null;
  } catch {
    return null;
  }
}

function readState(file: string): HistoryState {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as HistoryState;
    return parsed.version === 1 ? parsed : emptyState();
  } catch {
    return emptyState();
  }
}

function writeAtomic(file: string, content: string): void {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, content, { mode: 0o644 });
  fs.renameSync(tmp, file);
}

export async function runProbe(now = Date.now()): Promise<void> {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const historyFile = path.join(DATA_DIR, 'history.json');

  const [health, startedAt] = await Promise.all([checkHealth(HEALTH_URL), readStartedAt(PM2_NAME)]);
  const sample: Sample = { at: now, up: health.up, ms: health.ms, startedAt };

  const next = applySample(readState(historyFile), sample);
  writeAtomic(historyFile, JSON.stringify(next));
  writeAtomic(path.join(DATA_DIR, 'status.json'), JSON.stringify(buildPublicStatus(next, now)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runProbe().catch((error) => {
    console.error('status probe failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
