import matter from 'gray-matter';

import {
  LINK_KINDS,
  violation,
  type Eol,
  type LinkKind,
  type RecordSource,
  type Violation,
  type WorkRecord
} from './types';

export interface ParsedFile {
  data: Record<string, unknown>;
  body: string;
  eol: Eol;
}

export type ParseOutcome =
  | { ok: true; record: WorkRecord }
  | { ok: false; violation: Violation };

const BOM = '\uFEFF';

/**
 * Разбор одной записи. Строка на входе, объект на выходе — файловой системы
 * здесь нет, поэтому разбор тестируется без окружения.
 */
export function parseRecord(text: string, source: RecordSource): ParseOutcome {
  const clean = text.startsWith(BOM) ? text.slice(1) : text;

  // Front matter обязан быть первым блоком файла (правило 1 контракта): иначе
  // gray-matter молча вернёт пустой data, и запись притворится безымянной.
  if (!/^---\r?\n/.test(clean)) {
    return fail(source, 'Файл не начинается с front matter. Первая строка должна быть `---`.');
  }

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(clean);
  } catch (error) {
    const reason = error instanceof Error ? error.message.split('\n')[0] : String(error);
    return fail(source, `YAML во front matter не разбирается: ${reason ?? 'причина неизвестна'}.`);
  }

  const raw: unknown = parsed.data;
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return fail(source, 'Front matter должен быть набором полей, а не списком или скаляром.');
  }
  // Проверяем разобранные поля, а не исходный текст: gray-matter отдаёт из кэша
  // результат без строки front matter, и опираться на неё нельзя.
  if (Object.keys(raw as Record<string, unknown>).length === 0) {
    return fail(source, 'Front matter пуст: как минимум нужны `id`, `type`, `title`, `status`, `created`, `updated`.');
  }

  const data = coerceDates(raw) as Record<string, unknown>;

  return {
    ok: true,
    record: {
      // Пустая строка означает «идентификатора нет»: об этом скажет схема,
      // а разбор не обязан домысливать за автора файла.
      id: typeof data['id'] === 'string' ? data['id'] : '',
      type: typeof data['type'] === 'string' ? data['type'] : '',
      status: typeof data['status'] === 'string' ? data['status'] : '',
      title: typeof data['title'] === 'string' ? data['title'] : '',
      data,
      links: readLinks(data['links']),
      body: parsed.content,
      eol: detectEol(clean),
      source
    }
  };
}

function fail(source: RecordSource, message: string): ParseOutcome {
  return { ok: false, violation: violation('parse_failed', null, source.path, message) };
}

/**
 * Перевод строки запоминается при чтении: запись фазы 3 обязана вернуть тот же,
 * иначе смена CRLF на LF даст дифф на весь файл.
 */
export function detectEol(text: string): Eol {
  return text.includes('\r\n') ? 'crlf' : 'lf';
}

/**
 * И js-yaml, и питоновский yaml разбирают `2026-08-30` в объект даты, а схема
 * ждёт строку с `format: date`. Приводим до проверки, иначе валидатор спотыкается
 * на первом же файле.
 */
export function coerceDates(value: unknown): unknown {
  if (value instanceof Date) return dateToIso(value);
  if (Array.isArray(value)) return value.map(coerceDates);
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = coerceDates(item);
    }
    return result;
  }
  return value;
}

/**
 * Ровная полночь по UTC — это записанная в файле дата без времени (`2026-08-30`),
 * а не момент. Время появляется только у `started_at` отчётов, и его мы сохраняем.
 */
function dateToIso(date: Date): string {
  const iso = date.toISOString();
  const midnight = date.getUTCHours() === 0 && date.getUTCMinutes() === 0
    && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0;
  return midnight ? iso.slice(0, 10) : iso;
}

/** Первый заголовок первого уровня в теле. Внутрь блоков кода не заглядываем. */
export function firstHeading(body: string): string | null {
  let fenced = false;
  for (const line of body.split(/\r?\n/)) {
    if (/^\s{0,3}(```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const match = /^#\s+(.+?)\s*$/.exec(line);
    if (match?.[1]) return match[1];
  }
  return null;
}

/**
 * Связи читаются терпимо: неизвестные ключи и нестроковые элементы отбрасываются,
 * о них скажет схема. Иначе одна опечатка в `links` погасила бы весь граф.
 */
function readLinks(raw: unknown): Partial<Record<LinkKind, string[]>> {
  const links: Partial<Record<LinkKind, string[]>> = {};
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return links;
  const source = raw as Record<string, unknown>;
  for (const kind of LINK_KINDS) {
    const value = source[kind];
    if (!Array.isArray(value)) continue;
    links[kind] = value.filter((item): item is string => typeof item === 'string');
  }
  return links;
}
