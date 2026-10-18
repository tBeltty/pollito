import { en } from './catalogs/en.js';
import { es } from './catalogs/es.js';
import { formatMessage, type MessageParams } from './messageFormat.js';

export const SUPPORTED_LOCALES = ['en', 'es'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export type MessageKey = keyof typeof en;
export type MessageCatalog = Record<MessageKey, string>;

const CATALOGS: Record<Locale, MessageCatalog> = { en, es };

export function getCatalog(locale: Locale): MessageCatalog {
  return CATALOGS[locale];
}

/**
 * Maps Slack and BCP 47 tags (`es-419`, `es_MX`, `en-US`) to a supported locale.
 * Returns null for empty or unsupported input so callers can try the next candidate.
 */
export function normalizeLocale(raw: string | null | undefined): Locale | null {
  if (!raw) return null;
  const language = raw.trim().toLowerCase().split(/[-_]/)[0];
  return (SUPPORTED_LOCALES as readonly string[]).includes(language ?? '')
    ? (language as Locale)
    : null;
}

export interface LocaleCandidates {
  /** Locale reported by Slack for the acting user (users.info). */
  userLocale?: string | null;
  /** Workspace default configured by an admin. */
  workspaceLocale?: string | null;
}

/** Resolution order: user locale, then workspace default, then English. */
export function resolveLocale(candidates: LocaleCandidates = {}): Locale {
  return (
    normalizeLocale(candidates.userLocale) ??
    normalizeLocale(candidates.workspaceLocale) ??
    DEFAULT_LOCALE
  );
}

export type RelativeUnit = Intl.RelativeTimeFormatUnit;

export interface Translator {
  readonly locale: Locale;
  /** Looks up a key, falling back to English and finally to the key itself. */
  t(key: MessageKey, params?: MessageParams): string;
  formatNumber(value: number, options?: Intl.NumberFormatOptions): string;
  formatDate(value: Date, options?: Intl.DateTimeFormatOptions): string;
  formatRelativeTime(value: number, unit: RelativeUnit): string;
  formatList(items: readonly string[], type?: 'conjunction' | 'disjunction'): string;
}

export function createTranslator(locale: Locale = DEFAULT_LOCALE): Translator {
  const catalog = CATALOGS[locale];

  return {
    locale,
    t(key, params) {
      const template = catalog[key] ?? en[key] ?? key;
      return formatMessage(template, locale, params);
    },
    formatNumber(value, options) {
      return new Intl.NumberFormat(locale, options).format(value);
    },
    formatDate(value, options) {
      return new Intl.DateTimeFormat(locale, options).format(value);
    },
    formatRelativeTime(value, unit) {
      return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(value, unit);
    },
    formatList(items, type = 'conjunction') {
      return new Intl.ListFormat(locale, { style: 'long', type }).format(items);
    },
  };
}

const translatorCache = new Map<Locale, Translator>();

/** Shared translator instance per locale (translators are stateless). */
export function getTranslator(locale: Locale = DEFAULT_LOCALE): Translator {
  const cached = translatorCache.get(locale);
  if (cached) return cached;
  const created = createTranslator(locale);
  translatorCache.set(locale, created);
  return created;
}

export const defaultTranslator: Translator = getTranslator(DEFAULT_LOCALE);

/** Slack truncates or rejects text over its limits, so clamp with an ellipsis. */
export function clampText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export type { MessageParams };
