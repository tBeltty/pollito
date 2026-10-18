export type MessageParams = Readonly<Record<string, string | number>>;

type PluralCategory = Intl.LDMLPluralRule;

interface FormatContext {
  locale: string;
  params: MessageParams;
  pluralNumber?: number;
}

/**
 * Minimal ICU MessageFormat subset: `{name}`, `{n, plural, =0 {..} one {..} other {..}}`
 * (with `#` as the formatted number) and `{x, select, a {..} other {..}}`.
 * Parameter values are inserted verbatim and never re-parsed, so user input
 * such as poll questions cannot inject placeholders.
 */
export function formatMessage(
  template: string,
  locale: string,
  params: MessageParams = {}
): string {
  const { text } = parseSegment(template, 0, false, { locale, params });
  return text;
}

function parseSegment(
  template: string,
  startIndex: number,
  stopAtClosingBrace: boolean,
  context: FormatContext
): { text: string; end: number } {
  let output = '';
  let index = startIndex;

  while (index < template.length) {
    const char = template[index];

    if (char === '}' && stopAtClosingBrace) {
      return { text: output, end: index };
    }

    if (char === '#' && context.pluralNumber !== undefined) {
      output += new Intl.NumberFormat(context.locale).format(context.pluralNumber);
      index += 1;
      continue;
    }

    if (char === '{') {
      const argument = parseArgument(template, index, context);
      output += argument.text;
      index = argument.end;
      continue;
    }

    output += char;
    index += 1;
  }

  return { text: output, end: index };
}

function parseArgument(
  template: string,
  openIndex: number,
  context: FormatContext
): { text: string; end: number } {
  const closeIndex = findMatchingBrace(template, openIndex);
  const inner = template.slice(openIndex + 1, closeIndex);
  const firstComma = inner.indexOf(',');

  if (firstComma === -1) {
    return { text: formatValue(inner.trim(), context), end: closeIndex + 1 };
  }

  const name = inner.slice(0, firstComma).trim();
  const rest = inner.slice(firstComma + 1);
  const secondComma = rest.indexOf(',');
  const kind = (secondComma === -1 ? rest : rest.slice(0, secondComma)).trim();
  const bodyOffset =
    openIndex + 1 + firstComma + 1 + (secondComma === -1 ? rest.length : secondComma + 1);

  const branches = parseBranches(template, bodyOffset, closeIndex);
  const value = context.params[name];

  if (kind === 'plural') {
    const count = Number(value);
    const exact = branches.get(`=${count}`);
    const category: PluralCategory = new Intl.PluralRules(context.locale).select(count);
    const branch = exact ?? branches.get(category) ?? branches.get('other');
    if (branch === undefined) {
      return { text: '', end: closeIndex + 1 };
    }
    const nested = parseSegment(branch, 0, false, { ...context, pluralNumber: count });
    return { text: nested.text, end: closeIndex + 1 };
  }

  if (kind === 'select') {
    const branch = branches.get(String(value)) ?? branches.get('other');
    if (branch === undefined) {
      return { text: '', end: closeIndex + 1 };
    }
    return { text: parseSegment(branch, 0, false, context).text, end: closeIndex + 1 };
  }

  return { text: formatValue(name, context), end: closeIndex + 1 };
}

function parseBranches(
  template: string,
  startIndex: number,
  endIndex: number
): Map<string, string> {
  const branches = new Map<string, string>();
  let index = startIndex;

  while (index < endIndex) {
    while (index < endIndex && /\s/.test(template[index]!)) index += 1;
    if (index >= endIndex) break;

    let selectorEnd = index;
    while (selectorEnd < endIndex && !/[\s{]/.test(template[selectorEnd]!)) selectorEnd += 1;
    const selector = template.slice(index, selectorEnd);

    index = selectorEnd;
    while (index < endIndex && /\s/.test(template[index]!)) index += 1;
    if (template[index] !== '{') break;

    const branchClose = findMatchingBrace(template, index);
    branches.set(selector, template.slice(index + 1, branchClose));
    index = branchClose + 1;
  }

  return branches;
}

function findMatchingBrace(template: string, openIndex: number): number {
  let depth = 0;
  for (let index = openIndex; index < template.length; index += 1) {
    if (template[index] === '{') depth += 1;
    if (template[index] === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new Error(`Unbalanced braces in message template: ${template}`);
}

function formatValue(name: string, context: FormatContext): string {
  const value = context.params[name];
  if (value === undefined) return `{${name}}`;
  return typeof value === 'number'
    ? new Intl.NumberFormat(context.locale).format(value)
    : value;
}
