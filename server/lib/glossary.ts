/**
 * Глоссарий проекта (T-0041). Формат — файл `docs/development/glossary.md`,
 * строка на термин: `- **Термин** — определение` (тире, двоеточие или дефис).
 * Решение о формате оформляется отдельной записью A- человеком. Чистые функции
 * над строками; в пакет контекста (ADR-0021, вид `glossary`) попадают только
 * термины, упомянутые в тексте запроса.
 */
export interface GlossaryTerm { term: string; definition: string }

const LINE = /^\s*(?:[-*+]\s+)?\*\*(.+?)\*\*\s*(?:[—–:-])\s*(.+?)\s*$/;

export function parseGlossary(text: string): GlossaryTerm[] {
  const terms: GlossaryTerm[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = LINE.exec(line);
    if (match?.[1] && match[2]) terms.push({ term: match[1].trim(), definition: match[2] });
  }
  return terms;
}

/** Термин упомянут, если встречается как начало слова (без учёта регистра); окончание отрезается, чтобы «требованию» находило «требование». */
export function mentionedTerms(terms: readonly GlossaryTerm[], text: string): GlossaryTerm[] {
  const haystack = text.toLowerCase();
  return terms.filter((entry) => {
    const stem = entry.term.toLowerCase();
    const cut = stem.length > 5 ? stem.slice(0, -1) : stem;
    return new RegExp(`(^|[^\\p{L}\\p{N}])${cut.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u').test(haystack);
  });
}

/** Кусок пакета контекста: что, откуда, почему включено, сколько весит (ADR-0021). */
export interface PackChunk { kind: 'glossary'; source: string; why: string; size: number; text: string }

export function glossaryChunk(terms: readonly GlossaryTerm[], requestText: string): PackChunk | null {
  const used = mentionedTerms(terms, requestText);
  if (used.length === 0) return null;
  const text = used.map((entry) => `- ${entry.term} — ${entry.definition}`).join('\n');
  return { kind: 'glossary', source: 'docs/development/glossary.md', why: `термины из текста запроса: ${used.map((entry) => entry.term).join(', ')}`, size: text.length, text };
}
