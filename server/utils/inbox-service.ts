import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { parseProposal, resolveLinks, titleOf, type Note, type ProposedRecord } from '../lib/inbox';
import { normalizeRoot, resolveInside, toProjectPath } from '../lib/paths';
import { nextId, recordTemplate } from '../lib/scaffold';
import { targetPath } from '../lib/import';
import { DEVELOPMENT_DIR } from '../lib/types';
import { readWorkspace } from '../lib/workspace';
import { dropCache } from '../lib/cache';
import { loadIndex } from './index-service';
import { today } from './record-write';

/**
 * Входящее: сырые заметки и заведение записей по ним (docs/10-inbox.md).
 *
 * Записи создаёт приложение, а не модель: номера выдаёт оно, front matter и
 * имена файлов — его работа. В `docs/development` не попадает ничего, чего не
 * подтвердил человек нажатием «Завести записи».
 */

/** Куда переезжает разобранная заметка: удалять чужой текст приложение не вправе. */
export const DONE_DIR = 'принятое';

/** Заметки склада. Склад не назван в манифесте — и экрана входящего нет. */
export function inboxNotes(root: string): Note[] {
  const normalized = normalizeRoot(root);
  const workspace = readWorkspace(normalized);
  const notes: Note[] = [];

  for (const folder of workspace.manifest.sources?.inbox ?? []) {
    const absolute = join(normalized, folder);
    if (!existsSync(absolute)) continue;

    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      // Разобранное лежит в своей папке и второй раз не предлагается.
      if (entry.isDirectory()) continue;
      if (!entry.name.toLowerCase().endsWith('.md')) continue;

      const path = join(absolute, entry.name);
      const text = readFileSync(path, 'utf8');
      notes.push({ path: toProjectPath(normalized, path), title: titleOf(entry.name, text), text });
    }
  }

  return notes.sort((first, second) => first.path.localeCompare(second.path));
}

export interface CreatedRecord {
  id: string;
  type: string;
  title: string;
  path: string;
}

export type InboxOutcome =
  | { ok: true; created: CreatedRecord[]; problems: string[] }
  | { ok: false; code: string; message: string; problems?: string[] };

/**
 * Завести записи по подтверждённому человеком списку. Номера раздаются здесь и
 * только здесь: модель их не знает и знать не может.
 */
export function createRecords(root: string, proposed: readonly ProposedRecord[], notes: readonly string[]): InboxOutcome {
  const normalized = normalizeRoot(root);
  if (proposed.length === 0) {
    return { ok: false, code: 'nothing_to_create', message: 'Список пуст: заводить нечего' };
  }

  const workspace = readWorkspace(normalized);
  const index = loadIndex(normalized);
  const taken = index.records.map((record) => record.id);
  const known = new Set(taken);

  // Сперва раздаём номера всем: связи между предложенными записями ссылаются
  // друг на друга, и вторая должна знать номер первой.
  const assigned = new Map<string, string>();
  for (const record of proposed) {
    const id = nextId(record.type, [...taken, ...assigned.values()]);
    assigned.set(record.key, id);
  }

  const created: CreatedRecord[] = [];
  const problems: string[] = [];
  const stamp = today();

  for (const record of proposed) {
    const id = assigned.get(record.key) as string;
    const resolved = resolveLinks(record.links, assigned);
    problems.push(...resolved.problems.map((problem) => `${record.title}: ${problem}`));

    // Связь на запись, которой нет: валидатор поймает её кодом `link_broken`,
    // но сказать об этом сразу дешевле, чем дать человеку найти это потом.
    for (const ids of Object.values(resolved.links)) {
      for (const target of ids ?? []) {
        if (known.has(target) || [...assigned.values()].includes(target)) continue;
        problems.push(`${record.title}: связь ведёт на \`${target}\`, а такой записи в проекте нет.`);
      }
    }

    const relative = targetPath(DEVELOPMENT_DIR, workspace.manifest.paths ?? {}, record.type, id, record.title);
    const absolute = resolveInside(normalized, relative);
    if (existsSync(absolute)) {
      problems.push(`${record.title}: по пути \`${relative}\` уже есть файл — запись не заведена.`);
      continue;
    }

    // Имя заметки в журнал пускаем, только если это правда одна из
    // разбираемых: свободный текст модели в журнале записи не место.
    const source = record.note && notes.includes(record.note) ? record.note : '';

    const text = recordTemplate({
      id,
      type: record.type,
      title: record.title,
      today: stamp,
      links: resolved.links,
      ...(source ? { source } : {}),
      ...(record.body ? { body: record.body } : {}),
      ...(record.type === 'task' && record.change ? { change: record.change } : {})
    });

    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, text, 'utf8');
    created.push({ id, type: record.type, title: record.title, path: relative });
  }

  // Заметку переносим только тогда, когда по ней что-то завелось: иначе она
  // исчезнет со склада, не оставив следа ни в чём.
  if (created.length > 0) {
    for (const note of notes) problems.push(...archive(normalized, note));
  }

  dropCache(normalized);
  return { ok: true, created, problems };
}

/** Разобранная заметка переезжает в `принятое`, а не удаляется. */
function archive(root: string, note: string): string[] {
  try {
    const from = resolveInside(root, note);
    if (!existsSync(from)) return [];

    const name = note.split('/').pop() ?? note;
    const to = resolveInside(root, `${dirname(note).split('\\').join('/')}/${DONE_DIR}/${name}`);

    mkdirSync(dirname(to), { recursive: true });
    // Имя занято — добавляем время: затирать чужой файл нельзя.
    const target = existsSync(to) ? to.replace(/\.md$/i, `-${Date.now()}.md`) : to;
    renameSync(from, target);
    return [];
  } catch (error) {
    return [`Заметку \`${note}\` не удалось перенести в \`${DONE_DIR}\`: ${String(error)}`];
  }
}

/** Разбор ответа модели: список предложенных записей и претензии к форме. */
export function proposalOf(answer: string) {
  return parseProposal(answer);
}

/** Сколько всего заметок ждёт разбора: цифра для экрана. */
export function inboxSize(root: string): number {
  try {
    return inboxNotes(root).length;
  } catch {
    return 0;
  }
}

/** Есть ли у файла заметки размер: пустую разбирать незачем. */
export function noteSize(root: string, note: string): number {
  try {
    return statSync(resolveInside(normalizeRoot(root), note)).size;
  } catch {
    return 0;
  }
}
