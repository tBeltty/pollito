import { defaultTranslator, type MessageKey, type MessageParams, type Translator } from './index.js';

/**
 * Error whose message is a catalog key. `message` carries the English rendering for logs and
 * tests, while handlers call `describeError` to show the reader's language.
 */
export class LocalizedError extends Error {
  readonly key: MessageKey;
  readonly params?: MessageParams;

  constructor(key: MessageKey, params?: MessageParams) {
    super(defaultTranslator.t(key, params));
    this.name = 'LocalizedError';
    this.key = key;
    this.params = params;
  }
}

/**
 * Text safe to show in Slack: localized errors are translated, other errors keep their
 * message for English readers and fall back to a generic localized sentence otherwise.
 */
export function describeError(
  error: unknown,
  translator: Translator,
  fallbackKey: MessageKey
): string {
  if (error instanceof LocalizedError) {
    return translator.t(error.key, error.params);
  }
  if (error instanceof Error && error.message && translator.locale === 'en') {
    return error.message;
  }
  return translator.t(fallbackKey);
}
