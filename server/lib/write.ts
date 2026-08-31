import { load } from 'js-yaml';

import { coerceDates } from './parse';
import type { Eol, LinkKind } from './types';

/**
 * Запись front matter и журнала. Чистые функции над строками: файл читает и
 * пишет маршрут, а здесь решается, каким он станет.
 *
 * Front matter правится построчно, а не пересобирается из объекта. Пересборка
 * переставила бы ключи, потеряла бы незнакомые поля и комментарии — то есть
 * нарушила бы ровно те правила контракта, ради которых всё это пишется.
 */

export interface RecordFile {
  frontMatter: string;
  body: string;
  eol: Eol;
  /** Разделитель после закрывающего `---`: сохраняется как был. */
  tail: string;
}

export interface FrontMatterChanges {
  status?: string;
  change?: string | null;
  updated?: string;
  owner?: string | null;
  phase?: string | null;
  tags?: string[];
  links?: Partial<Record<LinkKind, string[]>>;
}

const FENCE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/;

export function splitRecord(text: string): RecordFile | null {
  const match = FENCE.exec(text);
  if (!match) return null;
  return {
    frontMatter: match[1] ?? '',
    body: text.slice(match[0].length),
    eol: text.includes('\r\n') ? 'crlf' : 'lf',
    tail: match[2] ?? ''
  };
}

export function joinRecord(file: RecordFile): string {
  const eol = file.eol === 'crlf' ? '\r\n' : '\n';
  return `---${eol}${file.frontMatter}${eol}---${file.tail}${file.body}`;
}

export function eolOf(file: RecordFile): string {
  return file.eol === 'crlf' ? '\r\n' : '\n';
}

/**
 * Правка полей front matter. Ключи, которых менять не просили, не трогаются
 * вовсе — включая те, о которых приложение ничего не знает.
 */
export function applyFrontMatter(file: RecordFile, changes: FrontMatterChanges): RecordFile {
  const eol = eolOf(file);
  let lines = file.frontMatter.split(/\r?\n/);

  if (changes.status !== undefined) lines = setScalar(lines, 'status', changes.status);
  if (changes.change !== undefined) lines = setScalar(lines, 'change', changes.change);
  if (changes.updated !== undefined) lines = setScalar(lines, 'updated', changes.updated);
  if (changes.owner !== undefined) lines = setScalar(lines, 'owner', changes.owner);
  if (changes.phase !== undefined) lines = setScalar(lines, 'phase', changes.phase);
  if (changes.tags !== undefined) lines = setScalar(lines, 'tags', flowList(changes.tags));
  if (changes.links !== undefined) lines = setLinks(lines, changes.links, eol);

  return { ...file, frontMatter: lines.join(eol) };
}

/**
 * Строка журнала: `- 2026-08-30 · в разработку · architect`
 * (docs/02-workspace-contract.md). Раздел «Журнал» создаётся, если его нет:
 * это единственное, что приложение вправе дописать в тело.
 */
export function journalLine(date: string, action: string, actor: string): string {
  const who = actor.trim();
  return who ? `- ${date} · ${action} · ${who}` : `- ${date} · ${action}`;
}

export function appendJournal(file: RecordFile, line: string): RecordFile {
  const eol = eolOf(file);
  const lines = file.body.split(/\r?\n/);
  const heading = lines.findIndex((text) => /^##\s+Журнал\s*$/.test(text));

  if (heading === -1) {
    // Раздела нет — создаём в конце, отделив пустой строкой от текста человека.
    const trimmed = [...lines];
    while (trimmed.length > 0 && trimmed[trimmed.length - 1] === '') trimmed.pop();
    return { ...file, body: [...trimmed, '', '## Журнал', '', line, ''].join(eol) };
  }

  // Ищем конец списка журнала: следующий заголовок или конец файла.
  let at = lines.length;
  for (let i = heading + 1; i < lines.length; i += 1) {
    if (/^#{1,6}\s/.test(lines[i] ?? '')) {
      at = i;
      break;
    }
  }
  while (at > heading + 1 && (lines[at - 1] ?? '').trim() === '') at -= 1;

  const next = [...lines.slice(0, at), line, ...lines.slice(at)];
  return { ...file, body: next.join(eol) };
}

/** Ровно те записи журнала, что уже есть: нужны сторожу для сверки. */
export function journalLines(body: string): string[] {
  const lines = body.split(/\r?\n/);
  const heading = lines.findIndex((text) => /^##\s+Журнал\s*$/.test(text));
  if (heading === -1) return [];
  const found: string[] = [];
  for (let i = heading + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (/^#{1,6}\s/.test(line)) break;
    if (line.trim().startsWith('- ')) found.push(line);
  }
  return found;
}

function setScalar(lines: string[], key: string, value: string | null): string[] {
  const at = indexOfKey(lines, key);

  if (value === null) {
    if (at === -1) return lines;
    return [...lines.slice(0, at), ...lines.slice(at + blockLength(lines, at))];
  }

  const line = `${key}: ${value}`;
  if (at === -1) return [...lines, line];
  return [...lines.slice(0, at), line, ...lines.slice(at + blockLength(lines, at))];
}

function setLinks(lines: string[], links: Partial<Record<LinkKind, string[]>>, eol: string): string[] {
  const kinds = (Object.keys(links) as LinkKind[]).filter((kind) => (links[kind]?.length ?? 0) > 0);
  const block = kinds.length === 0
    ? 'links: {}'
    : ['links:', ...kinds.map((kind) => `  ${kind}: ${flowList(links[kind] ?? [])}`)].join(eol);

  const at = indexOfKey(lines, 'links');
  const replacement = block.split(eol);
  if (at === -1) return [...lines, ...replacement];
  return [...lines.slice(0, at), ...replacement, ...lines.slice(at + blockLength(lines, at))];
}

/** Список в поточной форме: `[R-0001, R-0002]` — как в примерах контракта. */
function flowList(values: readonly string[]): string {
  return values.length === 0 ? '[]' : `[${values.join(', ')}]`;
}

function indexOfKey(lines: readonly string[], key: string): number {
  return lines.findIndex((line) => new RegExp(`^${key}:`).test(line));
}

/** Длина блока ключа: сама строка плюс вложенные, у которых отступ больше. */
function blockLength(lines: readonly string[], at: number): number {
  let length = 1;
  for (let i = at + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (line.trim() === '' || /^\s/.test(line)) length += 1;
    else break;
  }
  return length;
}

/**
 * Сторож тела документа (docs/02-workspace-contract.md). Обещание «меняем
 * только front matter и строку журнала» проверяется машиной, а не аккуратностью
 * того, кто писал код: документ у человека один, а попыток записать — сколько
 * угодно.
 */
export interface GuardOptions {
  /** Поля, которые действию разрешено менять. */
  allowedFields: readonly string[];
  /** Строка, которую действие вправе добавить в журнал. */
  addedJournalLine?: string;
}

export function verifyWrite(original: string, next: string, options: GuardOptions): string[] {
  const before = splitRecord(original);
  const after = splitRecord(next);
  if (!before || !after) return ['Файл перестал быть записью с front matter.'];

  const problems: string[] = [];

  if (before.eol !== after.eol) {
    problems.push(`Перевод строки изменился с ${before.eol} на ${after.eol}: это дало бы дифф на весь файл.`);
  }

  problems.push(...compareBody(before.body, after.body, options.addedJournalLine));
  problems.push(...compareFrontMatter(before.frontMatter, after.frontMatter, options.allowedFields));
  return problems;
}

function compareBody(before: string, after: string, addedLine?: string): string[] {
  if (before === after) return [];

  if (!addedLine) {
    return ['Тело документа изменилось, хотя действие не добавляет строку в журнал.'];
  }

  const beforeLines = before.split(/\r?\n/);
  const afterLines = after.split(/\r?\n/);

  // Раздела «Журнал» могло не быть: тогда добавляются заголовок и пустые строки
  // вокруг него. Сверяем текст человека, а не разметку, которую сами и создали.
  if (journalLines(before).length === 0 && /^##\s+Журнал\s*$/m.test(after)) {
    const cut = afterLines.findIndex((line) => /^##\s+Журнал\s*$/.test(line));
    const kept = afterLines.slice(0, cut).join('\n').replace(/\s+$/, '');
    const kept_before = beforeLines.join('\n').replace(/\s+$/, '');
    return kept === kept_before ? [] : ['Текст документа изменился при создании раздела «Журнал».'];
  }

  const inserted = insertedLines(beforeLines, afterLines);
  if (inserted === null) {
    return ['Тело документа изменилось не одной добавленной строкой: приложение не вправе переписывать текст.'];
  }
  if (inserted.length !== 1 || inserted[0] !== addedLine) {
    return [`В тело добавлено не то, что собирались: ожидалась одна строка журнала «${addedLine}».`];
  }
  if (!journalLines(after).includes(addedLine)) {
    return ['Строка журнала добавлена вне раздела «Журнал».'];
  }
  return [];
}

/** Строки, которых не было. `null` — если что-то ещё и изменилось или удалилось. */
function insertedLines(before: readonly string[], after: readonly string[]): string[] | null {
  if (after.length < before.length) return null;
  const added: string[] = [];
  let i = 0;
  for (let j = 0; j < after.length; j += 1) {
    if (i < before.length && before[i] === after[j]) {
      i += 1;
      continue;
    }
    added.push(after[j] ?? '');
  }
  return i === before.length ? added : null;
}

function compareFrontMatter(before: string, after: string, allowed: readonly string[]): string[] {
  const problems: string[] = [];

  const keysBefore = topLevelKeys(before);
  const keysAfter = topLevelKeys(after);
  const added = keysAfter.filter((key) => !keysBefore.includes(key));
  const removed = keysBefore.filter((key) => !keysAfter.includes(key));

  for (const key of [...added, ...removed]) {
    if (!allowed.includes(key)) {
      problems.push(`Поле \`${key}\` появилось или исчезло, а действию его менять нельзя.`);
    }
  }

  // Порядок ключей сохраняется: переставленный front matter даёт дифф, которого
  // человек не просил.
  const orderBefore = keysBefore.filter((key) => keysAfter.includes(key));
  const orderAfter = keysAfter.filter((key) => keysBefore.includes(key));
  if (orderBefore.join(',') !== orderAfter.join(',')) {
    problems.push('Порядок ключей front matter изменился.');
  }

  const valuesBefore = parseFrontMatter(before);
  const valuesAfter = parseFrontMatter(after);
  if (!valuesBefore || !valuesAfter) {
    problems.push('Front matter после правки не разбирается как YAML.');
    return problems;
  }

  for (const key of keysBefore) {
    if (allowed.includes(key)) continue;
    const was = JSON.stringify(valuesBefore[key] ?? null);
    const now = JSON.stringify(valuesAfter[key] ?? null);
    if (was !== now) {
      problems.push(`Поле \`${key}\` изменилось, а действию его менять нельзя: было ${was}, стало ${now}.`);
    }
  }

  return problems;
}

function topLevelKeys(frontMatter: string): string[] {
  const keys: string[] = [];
  for (const line of frontMatter.split(/\r?\n/)) {
    // Ключ может быть не латиницей: проект вправе назвать своё поле по-русски,
    // и потерять его молча — худшее, что может сделать сторож.
    const match = /^([^\s:#][^:]*):(?:\s|$)/.exec(line);
    if (match?.[1]) keys.push(match[1]);
  }
  return keys;
}

function parseFrontMatter(frontMatter: string): Record<string, unknown> | null {
  try {
    const parsed = coerceDates(load(frontMatter));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
