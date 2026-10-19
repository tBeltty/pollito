import { describe, expect, it } from 'vitest';
import { createTranslator } from '../../src/i18n/index.js';
import { LocalizedError, describeError } from '../../src/i18n/errors.js';
import { NUDGE_COOLDOWN_HOURS } from '../../src/config/limits.js';

describe('Localized reminder errors', () => {
  const cooldown = new LocalizedError('nudge.cooldown', { hours: NUDGE_COOLDOWN_HOURS });

  it('renders the cooldown with the configured hours in English and Spanish', () => {
    expect(describeError(cooldown, createTranslator('en'), 'error.generic.nudge')).toBe(
      'A reminder was already sent in the last 4 hours.'
    );
    expect(describeError(cooldown, createTranslator('es'), 'error.generic.nudge')).toBe(
      'Ya se envió un recordatorio en las últimas 4 horas.'
    );
  });

  it('never leaks an English message to Spanish readers for unexpected errors', () => {
    const text = describeError(new Error('boom'), createTranslator('es'), 'error.generic.nudge');
    expect(text).not.toContain('boom');
  });

  it('keeps reminder copy free of the old "Smart Nudge" name and em dashes in Block Kit titles', () => {
    for (const locale of ['en', 'es'] as const) {
      const t = createTranslator(locale);
      for (const key of ['nudge.disabled', 'settings.field.nudges', 'settings.option.nudges'] as const) {
        expect(t.t(key)).not.toMatch(/Smart Nudge/i);
      }
      expect(t.t('closure.title.quorum')).not.toContain('—');
      expect(t.t('closure.title.expired')).not.toContain('—');
    }
  });
});
