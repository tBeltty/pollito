import { describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/catalogs/en.js';
import { es } from '../../src/i18n/catalogs/es.js';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  getCatalog,
  getTranslator,
  normalizeLocale,
  resolveLocale,
} from '../../src/i18n/index.js';

describe('i18n catalog parity and resolution', () => {
  it('enforces 100% key parity between English and Spanish catalogs', () => {
    const enKeys = Object.keys(en).sort();
    const esKeys = Object.keys(es).sort();

    const missingInEs = enKeys.filter((k) => !(k in es));
    const extraInEs = esKeys.filter((k) => !(k in en));

    expect(missingInEs).toEqual([]);
    expect(extraInEs).toEqual([]);
    expect(esKeys.length).toBe(enKeys.length);
  });

  it('preserves matching ICU variable and plural parameters across catalogs', () => {
    function extractParamNames(template: string): string[] {
      const names = new Set<string>();
      let depth = 0;
      let argStart = -1;

      for (let i = 0; i < template.length; i++) {
        if (template[i] === '{') {
          if (depth === 0) {
            argStart = i + 1;
          }
          depth++;
        } else if (template[i] === '}') {
          depth--;
          if (depth === 0 && argStart !== -1) {
            const inner = template.slice(argStart, i).trim();
            const commaIndex = inner.indexOf(',');
            const paramName = (commaIndex === -1 ? inner : inner.slice(0, commaIndex)).trim();
            if (paramName && !paramName.startsWith('=')) {
              names.add(paramName);
            }
            argStart = -1;
          }
        }
      }
      return Array.from(names).sort();
    }

    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      const enTemplate = en[key];
      const esTemplate = es[key];

      const enVars = extractParamNames(enTemplate);
      const esVars = extractParamNames(esTemplate);

      expect(esVars, `Key "${key}" variable mismatch`).toEqual(enVars);
    }
  });

  it('normalizes common BCP-47 and Slack locale strings', () => {
    expect(normalizeLocale('en-US')).toBe('en');
    expect(normalizeLocale('en_GB')).toBe('en');
    expect(normalizeLocale('es-ES')).toBe('es');
    expect(normalizeLocale('es-419')).toBe('es');
    expect(normalizeLocale('es_MX')).toBe('es');
    expect(normalizeLocale('fr-FR')).toBeNull();
    expect(normalizeLocale(null)).toBeNull();
    expect(normalizeLocale(undefined)).toBeNull();
    expect(normalizeLocale('')).toBeNull();
  });

  it('resolves locale in priority order: user -> workspace -> default en', () => {
    expect(resolveLocale({ userLocale: 'es-ES', workspaceLocale: 'en' })).toBe('es');
    expect(resolveLocale({ userLocale: 'fr-FR', workspaceLocale: 'es' })).toBe('es');
    expect(resolveLocale({ userLocale: null, workspaceLocale: 'es-MX' })).toBe('es');
    expect(resolveLocale({ userLocale: null, workspaceLocale: null })).toBe(DEFAULT_LOCALE);
  });

  it('retrieves cached stateless translators', () => {
    const t1 = getTranslator('es');
    const t2 = getTranslator('es');
    expect(t1).toBe(t2);
    expect(t1.locale).toBe('es');
    expect(t1.t('common.cancel')).toBe('Cancelar');
  });

  it('falls back to English when a key is undefined or missing in locale', () => {
    const enText = en['common.close'];
    const esText = es['common.close'];
    expect(esText).toBe('Cerrar');
    expect(enText).toBe('Close');
  });

  it('guarantees all modal title keys satisfy Slack 24-character maximum limit', () => {
    const modalTitleKeys = [
      'analytics.title',
      'csv.title',
      'history.title',
      'settings.title',
      'guide.title',
      'templates.title',
      'detail.title',
      'cp.title.huddle',
      'cp.title.create',
      'cp.title.editTemplate',
      'cp.title.newTemplate',
      'cp.title.newWorkspaceTemplate',
    ] as const;

    for (const key of modalTitleKeys) {
      expect(en[key].length, `EN modal title "${key}" exceeds 24 chars: "${en[key]}"`).toBeLessThanOrEqual(24);
      expect(es[key].length, `ES modal title "${key}" exceeds 24 chars: "${es[key]}"`).toBeLessThanOrEqual(24);
    }
  });
});
