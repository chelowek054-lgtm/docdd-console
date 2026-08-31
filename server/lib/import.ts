import { firstHeading } from './parse';
import { fileNameFor, initialStatus, isRecordType, SECTION_BY_TYPE } from './scaffold';
import type { RecordType } from './types';

/**
 * Импорт существующей документации. Приложение показывает, что нашло, и
 * применяет утверждённый человеком план — предполагать за него оно не берётся
 * (docs/adr/0003-no-llm-in-app.md).
 */

export interface SurveyRow {
  path: string;
  title: string;
  hasFrontMatter: boolean;
  /** Предположение, а не решение: человек правит его на экране. */
  suggestedType: RecordType | null;
  reason: string;
  bytes: number;
}

/** Слова в пути, по которым узнаётся раздел. Только явные — гадать не наше дело. */
const PATH_HINTS: readonly { pattern: RegExp; type: RecordType; reason: string }[] = [
  { pattern: /(^|\/)(adr|decisions?|решени)/i, type: 'decision', reason: 'папка решений в пути' },
  { pattern: /(^|\/)(requirements?|требовани)/i, type: 'requirement', reason: 'папка требований в пути' },
  { pattern: /(^|\/)(contracts?|api|openapi)/i, type: 'contract', reason: 'папка контрактов в пути' },
  { pattern: /(^|\/)(tests?|verification|проверк)/i, type: 'verification', reason: 'папка проверок в пути' },
  { pattern: /(^|\/)(tasks?|задач)/i, type: 'task', reason: 'папка задач в пути' },
  // `docs` намеренно не признак: это корень импорта, под ним лежит всё подряд.
  // Подсказка, которая срабатывает всегда, — шум, притворяющийся подсказкой.
  { pattern: /(^|\/)(design|architecture|проектн)/i, type: 'design', reason: 'папка проектных документов в пути' }
];

const NAME_HINTS: readonly { pattern: RegExp; type: RecordType; reason: string }[] = [
  { pattern: /^adr-\d+|^\d{4}-.*-(decision|решение)/i, type: 'decision', reason: 'имя файла как у решения' },
  { pattern: /openapi|asyncapi|schema/i, type: 'contract', reason: 'имя файла как у контракта' }
];

export function surveyFile(path: string, text: string): SurveyRow {
  const hasFrontMatter = /^﻿?---[ \t]*\r?\n/.test(text);
  const guess = guessType(path);
  return {
    path,
    title: firstHeading(text) ?? fallbackTitle(path),
    hasFrontMatter,
    suggestedType: guess?.type ?? null,
    reason: guess?.reason ?? 'по пути ничего не понятно — выберите тип сами',
    bytes: Buffer.byteLength(text, 'utf8')
  };
}

function guessType(path: string): { type: RecordType; reason: string } | null {
  const name = path.split('/').pop() ?? '';
  for (const hint of NAME_HINTS) {
    if (hint.pattern.test(name)) return { type: hint.type, reason: hint.reason };
  }
  const folders = path.split('/').slice(0, -1).join('/');
  for (const hint of PATH_HINTS) {
    if (hint.pattern.test(folders)) return { type: hint.type, reason: hint.reason };
  }
  return null;
}

/** Имя файла как заголовок — последнее средство, когда в тексте нет `#`. */
function fallbackTitle(path: string): string {
  const name = (path.split('/').pop() ?? '').replace(/\.md$/i, '');
  const words = name.replace(/[-_]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : path;
}

export interface PlanRow {
  path: string;
  type: string;
  title: string;
}

export interface PlannedMove {
  from: string;
  to: string;
  id: string;
  type: RecordType;
  title: string;
  text: string;
}

export interface SkippedRow {
  path: string;
  reason: string;
}

/**
 * Front matter добавляется в начало, тело остаётся байт в байт. Перевод строки
 * берётся из самого файла: смена CRLF на LF дала бы дифф на весь документ ещё
 * до того, как человек успел его прочитать.
 */
export function withFrontMatter(
  text: string,
  input: { id: string; type: RecordType; title: string; today: string }
): string {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = [
    '---',
    `id: ${input.id}`,
    `type: ${input.type}`,
    `title: ${input.title}`,
    `status: ${initialStatus(input.type)}`,
    `created: ${input.today}`,
    `updated: ${input.today}`
  ];
  if (input.type === 'verification') lines.push('kind: manual');
  if (input.type === 'task') lines.push('links: {}');
  lines.push('---', '');

  return lines.join(eol) + eol + text;
}

export function targetPath(
  developmentDir: string,
  sections: Partial<Record<string, string>>,
  type: RecordType,
  id: string,
  title: string
): string {
  const folder = sections[SECTION_BY_TYPE[type]] ?? SECTION_BY_TYPE[type];
  return `${developmentDir}/${folder}/${fileNameFor(id, title)}`;
}

export function checkRow(row: PlanRow, text: string): string | null {
  if (!isRecordType(row.type)) return `Тип \`${row.type}\` не из списка контракта`;
  if (/^﻿?---[ \t]*\r?\n/.test(text)) {
    return 'У файла уже есть front matter: это запись, а не импорт';
  }
  if (!row.title.trim()) return 'Пустой заголовок: запись без названия не найти в списке';
  return null;
}
