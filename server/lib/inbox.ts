import { LINK_KINDS, RECORD_TYPES, type LinkKind, type RecordType } from './types';
import { validateRecords } from './schema';

/**
 * Разбор входящего: из сырых заметок — список предложенных записей
 * (docs/10-inbox.md).
 *
 * Здесь только счёт над текстом: файлы читает и создаёт вызывающий. Записи
 * заводит приложение, а не модель, поэтому номеров в ответе модели нет — она
 * ссылается на соседние записи по ключу, а номера раздаются при заведении.
 */

const NEW_LINE = String.fromCharCode(10);

export interface ProposedRecord {
  key: string;
  type: RecordType;
  title: string;
  body?: string;
  change?: string;
  /** Заметка, из которой взялась запись: уходит в журнал. */
  note?: string;
  links?: Record<string, string[]>;
}

export interface ParsedProposal {
  records: ProposedRecord[];
  problems: string[];
}

/** Блок ```docdd-records — тем же способом, что и блоки карт. */
export function recordsBlock(answer: string): string | null {
  const pattern = /^[ \t]*(?:```|~~~)[ \t]*docdd-records[ \t]*\r?\n([\s\S]*?)^[ \t]*(?:```|~~~)[ \t]*$/m;
  const match = pattern.exec(answer);
  return match ? (match[1] ?? '') : null;
}

/**
 * Что модель предложила завести. Ответ, не прошедший схему, не превращается в
 * записи: писать в проект то, что не разбирается, приложение не станет.
 */
export function parseProposal(answer: string): ParsedProposal {
  const raw = recordsBlock(answer);
  if (raw === null) {
    return { records: [], problems: ['В ответе нет блока `docdd-records`: заводить нечего.'] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      records: [],
      problems: [`Блок \`docdd-records\` не разбирается как JSON: ${error instanceof Error ? error.message : String(error)}`]
    };
  }

  // Одиночное значение вместо списка — не выдумка, а форма: смысл тот же.
  // Приводим до проверки, потому что отвергать за это значит терять разбор
  // целиком из-за пары квадратных скобок (docs/10-inbox.md).
  listifyLinks(parsed);

  const issues = validateRecords(parsed);
  if (issues.length > 0) {
    return { records: [], problems: issues.map((issue) => issue.message) };
  }

  const records = (parsed as { records: ProposedRecord[] }).records;
  return { records, problems: duplicateKeys(records) };
}

/** `"implements": "ключ"` — та же связь, что и `["ключ"]`. */
function listifyLinks(parsed: unknown): void {
  const records = (parsed as { records?: unknown })?.records;
  if (!Array.isArray(records)) return;

  for (const record of records) {
    const links = (record as { links?: unknown })?.links;
    if (!links || typeof links !== 'object') continue;

    for (const [kind, value] of Object.entries(links as Record<string, unknown>)) {
      if (typeof value === 'string') (links as Record<string, unknown>)[kind] = [value];
    }
  }
}

/** Два одинаковых ключа — и связь ведёт неизвестно куда. */
function duplicateKeys(records: readonly ProposedRecord[]): string[] {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const record of records) {
    if (seen.has(record.key)) twice.add(record.key);
    seen.add(record.key);
  }
  return [...twice].map((key) => `Ключ \`${key}\` занят дважды: непонятно, на какую запись ведут связи.`);
}

export interface ResolvedLinks {
  links: Partial<Record<LinkKind, string[]>>;
  /** Что не удалось связать: ключ, которого нет, или незнакомый вид связи. */
  problems: string[];
}

/** Идентификатор записи: `R-0001` и подобные. */
const RECORD_ID = /^[RDACTPVM]-\d{4}$/;

/**
 * Связи предложенной записи в настоящие идентификаторы. Модель называет
 * соседей по ключу — номера она знать не может, их раздаёт приложение.
 */
export function resolveLinks(
  links: Record<string, string[]> | undefined,
  assigned: ReadonlyMap<string, string>
): ResolvedLinks {
  const resolved: Partial<Record<LinkKind, string[]>> = {};
  const problems: string[] = [];

  for (const [kind, values] of Object.entries(links ?? {})) {
    if (!isLinkKind(kind)) {
      problems.push(`Связь \`${kind}\` не из списка контракта — пропущена.`);
      continue;
    }

    const ids: string[] = [];
    for (const value of values) {
      // Уже заведённая запись называется номером, предложенная — ключом.
      if (RECORD_ID.test(value)) {
        ids.push(value);
        continue;
      }
      const id = assigned.get(value);
      if (id) {
        ids.push(id);
        continue;
      }
      problems.push(`Связь \`${kind}\` ведёт на \`${value}\`, а такого ключа в ответе нет — пропущена.`);
    }

    if (ids.length > 0) resolved[kind] = ids;
  }

  return { links: resolved, problems };
}

function isLinkKind(value: string): value is LinkKind {
  return (LINK_KINDS as readonly string[]).includes(value);
}

export function isProposedType(value: string): value is RecordType {
  return (RECORD_TYPES as readonly string[]).includes(value);
}

/** Одна заметка входящего: путь, заголовок и текст. */
export interface Note {
  path: string;
  title: string;
  text: string;
}

/** Первая строка-заголовок или имя файла: заметке надо как-то называться. */
export function titleOf(path: string, text: string): string {
  const heading = text.split(NEW_LINE).find((line) => line.trim().startsWith('# '));
  if (heading) return heading.trim().slice(2).trim();

  const name = path.split('/').pop() ?? path;
  return name.replace(/\.md$/i, '');
}
