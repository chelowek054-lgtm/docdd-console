import type { WorkRecord } from './types';

/**
 * Сверка пачки по функции (R-0092, docs/10-inbox.md): требования, задачи и
 * проверки одной функции проверяются вместе, а не по одной. Чистые функции над
 * записями процесса — без файловой системы.
 */

export type GapKind = 'requirement_no_check' | 'requirement_no_task' | 'task_no_requirement' | 'check_not_runnable';

export interface BatchGap {
  kind: GapKind;
  /** Запись, у которой пробел. */
  id: string;
  message: string;
}

/** Запись снята с работы: заменена, отклонена, отменена — её пробелы никого не касаются. */
const OUT = new Set(['superseded', 'rejected', 'dropped', 'legacy']);
const MANUAL_KINDS = new Set(['manual', 'review']);

type Rec = Pick<WorkRecord, 'id' | 'type' | 'status' | 'links' | 'data' | 'body'>;

const live = (record: Rec) => !OUT.has(record.status);

/** Проверки требования: связь ставят с любой стороны (`verifies` у проверки, `verified_by` у требования). */
function checksOf(requirement: Rec, all: readonly Rec[]): Rec[] {
  const ids = new Set(requirement.links.verified_by ?? []);
  for (const record of all) if (record.type === 'verification' && (record.links.verifies ?? []).includes(requirement.id)) ids.add(record.id);
  return all.filter((record) => record.type === 'verification' && ids.has(record.id) && live(record));
}

/** Есть ли у ручной проверки шаги или ожидаемый результат, а у автоматической — команда запуска (в `command` или строкой «Запуск: `…`» в тексте). */
export function checkRunnable(check: Rec): boolean {
  const kind = typeof check.data['kind'] === 'string' ? check.data['kind'] : '';
  if (MANUAL_KINDS.has(kind)) {
    // Заготовка при заведении тоже содержит заголовок «Шаги»: пустой пункт-подсказка не в счёт.
    const steps = /^##\s+(Шаги|Ожидаемый результат)\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/gm;
    for (const match of check.body.matchAll(steps)) {
      const text = (match[2] ?? '').trim();
      if (text && !/^(1\.\s*Действие — ожидаемый результат\.|Что считается «прошла»\.)$/.test(text)) return true;
    }
    return false;
  }
  if (typeof check.data['command'] === 'string' && check.data['command'].trim() !== '') return true;
  // Команду допустимо назвать и в тексте проверки: «Запуск: `npm run test -- tests/x.spec.ts`» — так заведены проверки из разбора.
  return /(?:Запуск|Команда)\s*:\s*`[^`]+`/.test(check.body);
}

/** Пробелы вокруг одного требования: нет проверки, нет задачи, проверка не запускается. */
export function requirementGaps(requirement: Rec, all: readonly Rec[]): BatchGap[] {
  if (requirement.type !== 'requirement' || !live(requirement)) return [];
  const gaps: BatchGap[] = [];
  const checks = checksOf(requirement, all);
  if (checks.length === 0) gaps.push({ kind: 'requirement_no_check', id: requirement.id, message: `У требования ${requirement.id} нет ни одной проверки.` });
  for (const check of checks) {
    if (!checkRunnable(check)) gaps.push({ kind: 'check_not_runnable', id: check.id, message: `Проверку ${check.id} нечем прогнать: нет шагов и ожидаемого результата (ручная) или команды запуска (автоматическая).` });
  }
  const hasTask = all.some((record) => record.type === 'task' && live(record) && (record.links.implements ?? []).includes(requirement.id));
  if (!hasTask) gaps.push({ kind: 'requirement_no_task', id: requirement.id, message: `Требование ${requirement.id} не реализует ни одна задача.` });
  return gaps;
}

/** Пробелы вокруг задачи: сама задача без требования и пробелы требований, которые она реализует. */
export function taskGaps(task: Rec, all: readonly Rec[]): BatchGap[] {
  if (task.type !== 'task' || !live(task)) return [];
  const implemented = task.links.implements ?? [];
  if (implemented.length === 0) return [{ kind: 'task_no_requirement', id: task.id, message: `Задача ${task.id} не реализует ни одного требования.` }];
  const byId = new Map(all.map((record) => [record.id, record]));
  const gaps: BatchGap[] = [];
  for (const id of implemented) {
    const requirement = byId.get(id);
    // Задача уже реализует требование, так что «нет задачи» к ней не относится.
    if (requirement) gaps.push(...requirementGaps(requirement, all).filter((gap) => gap.kind !== 'requirement_no_task'));
  }
  return gaps;
}

/**
 * Пачка функции: задачи, чьи `affects` называют карты, объявившие возможность, —
 * и всё, что с ними связано. `maps` — номера записей карт этой возможности.
 */
export function batchGaps(all: readonly Rec[], maps: readonly string[]): BatchGap[] {
  const wanted = new Set(maps);
  const tasks = all.filter((record) => record.type === 'task' && live(record) && (record.links.affects ?? []).some((id) => wanted.has(id)));
  const seen = new Set<string>();
  const gaps: BatchGap[] = [];
  const add = (gap: BatchGap) => {
    const key = `${gap.kind}:${gap.id}`;
    if (!seen.has(key)) { seen.add(key); gaps.push(gap); }
  };
  for (const task of tasks) {
    for (const gap of taskGaps(task, all)) add(gap);
    for (const id of task.links.implements ?? []) {
      const requirement = all.find((record) => record.id === id);
      if (requirement) for (const gap of requirementGaps(requirement, all)) add(gap);
    }
  }
  return gaps;
}

/** Метки заметки входящего: роль автора и функция (R-0092). Строки `Роль: …` и `Функция: …` в начале файла. */
export interface NoteMeta { role?: string; feature?: string }

export function noteMeta(text: string): NoteMeta {
  const meta: NoteMeta = {};
  for (const line of text.split(/\r?\n/).slice(0, 12)) {
    const match = /^(?:[*_>\s-]*)(Роль|Функция)\s*:\s*(.+?)\s*$/i.exec(line);
    if (!match) continue;
    const value = (match[2] ?? '').replace(/[*_`]/g, '').trim();
    if (!value) continue;
    if ((match[1] ?? '').toLowerCase() === 'роль') meta.role ??= value; else meta.feature ??= value;
  }
  return meta;
}
