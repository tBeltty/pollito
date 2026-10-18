import { describe, expect, it } from 'vitest';
import { formatMessage } from '../../src/i18n/messageFormat.js';
import { createTranslator } from '../../src/i18n/index.js';

describe('ICU MessageFormat parser and Translator formatting', () => {
  it('interpolates direct variables without modifying surrounding prose', () => {
    const template = 'Poll closed: {question}';
    expect(formatMessage(template, 'en', { question: 'Sprint Date?' })).toBe(
      'Poll closed: Sprint Date?'
    );
  });

  it('formats ICU plural categories and hashes (#) correctly in English', () => {
    const template = '{count, plural, one {*#* vote} other {*#* votes}}';

    expect(formatMessage(template, 'en', { count: 1 })).toBe('*1* vote');
    expect(formatMessage(template, 'en', { count: 0 })).toBe('*0* votes');
    expect(formatMessage(template, 'en', { count: 42 })).toBe('*42* votes');
  });

  it('formats ICU plural categories and hashes (#) correctly in Spanish', () => {
    const template = '{count, plural, one {*#* voto} other {*#* votos}}';

    expect(formatMessage(template, 'es', { count: 1 })).toBe('*1* voto');
    expect(formatMessage(template, 'es', { count: 0 })).toBe('*0* votos');
    expect(formatMessage(template, 'es', { count: 15 })).toBe('*15* votos');
  });

  it('evaluates exact match plural selectors (=0, =1)', () => {
    const template = '{count, plural, =0 {No votes} one {# vote} other {# votes}}';
    expect(formatMessage(template, 'en', { count: 0 })).toBe('No votes');
    expect(formatMessage(template, 'en', { count: 1 })).toBe('1 vote');
    expect(formatMessage(template, 'en', { count: 5 })).toBe('5 votes');
  });

  it('evaluates ICU select statements', () => {
    const template = '{scope, select, workspace {Workspace} other {Personal}}';
    expect(formatMessage(template, 'en', { scope: 'workspace' })).toBe('Workspace');
    expect(formatMessage(template, 'en', { scope: 'user' })).toBe('Personal');
  });

  it('translates numbers and lists with standard Intl formatters', () => {
    const esTranslator = createTranslator('es');
    expect(esTranslator.formatNumber(12500)).toBe('12.500');
    expect(esTranslator.formatList(['Diseño', 'Backend', 'QA'])).toBe(
      'Diseño, Backend y QA'
    );
  });
});
