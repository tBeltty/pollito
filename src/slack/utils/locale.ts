import { PollService } from '../../services/pollService.js';
import {
  DEFAULT_LOCALE,
  getTranslator,
  normalizeLocale,
  resolveLocale,
  type Locale,
  type Translator,
} from '../../i18n/index.js';

const USER_LOCALE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHED_USERS = 5000;

const userLocaleCache = new Map<string, { slackLocale: string | null; expiresAt: number }>();

export function clearUserLocaleCache(): void {
  userLocaleCache.clear();
}

async function fetchSlackUserLocale(
  client: any,
  userId: string,
  token?: string
): Promise<string | null> {
  const cached = userLocaleCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.slackLocale;

  try {
    const response = await client?.users?.info?.({
      ...(token ? { token } : {}),
      user: userId,
      include_locale: true,
    });
    const slackLocale: string | null = response?.user?.locale ?? null;
    if (userLocaleCache.size >= MAX_CACHED_USERS) userLocaleCache.clear();
    userLocaleCache.set(userId, { slackLocale, expiresAt: Date.now() + USER_LOCALE_TTL_MS });
    return slackLocale;
  } catch {
    return null;
  }
}

export interface LocaleRequest {
  userId?: string;
  workspaceId?: string;
}

/**
 * Resolution order: Slack user locale (users.info) → workspace default → English.
 * Never throws: any lookup failure falls through to the next candidate.
 */
export async function resolveRequestLocale(
  client: any,
  { userId, workspaceId }: LocaleRequest
): Promise<Locale> {
  let botToken: string | undefined;
  if (workspaceId) {
    try {
      botToken = await PollService.resolveWorkspaceBotToken(workspaceId);
    } catch {
      botToken = undefined;
    }
  }

  const slackLocale = userId ? await fetchSlackUserLocale(client, userId, botToken) : null;
  const userLocale = normalizeLocale(slackLocale);
  if (userLocale) return userLocale;

  let workspaceLocale: Locale | null = null;
  if (workspaceId) {
    try {
      workspaceLocale = await PollService.getWorkspaceLocale(workspaceId);
    } catch {
      workspaceLocale = null;
    }
  }
  return resolveLocale({ userLocale: slackLocale, workspaceLocale });
}

export async function getRequestTranslator(
  client: any,
  request: LocaleRequest
): Promise<Translator> {
  return getTranslator(await resolveRequestLocale(client, request));
}

/** Translator for a shared surface that stores its language (poll cards, closure notices). */
export function getPollTranslator(poll: { locale?: string | null } | null | undefined): Translator {
  return getTranslator(normalizeLocale(poll?.locale) ?? DEFAULT_LOCALE);
}
