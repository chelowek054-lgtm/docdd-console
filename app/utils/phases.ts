// Относительный путь, а не алиас Nuxt: этот модуль читает и тест, который
// собирается без Nuxt.
import type { IndexRecord } from '../../server/lib/types';

/**
 * Фаза считается по задачам и вручную не ставится
 * (docs/02-workspace-contract.md, «Статусы»; docs/04-ui.md, «Фазы»). Чистая
 * функция, как укладка графа: те же записи — тот же ответ, и его видно тестом.
 */

export type PhaseState = 'planned' | 'active' | 'done';

export interface PhaseProgress {
  phase: IndexRecord;
  /** Состав: `covers` фазы и задачи с её номером в поле `phase` — одним множеством. */
  tasks: IndexRecord[];
  state: PhaseState;
  /** Закрытых задач — для полосы готовности. */
  done: number;
  /** Всех, кроме отменённых: отменённая работы не прибавляет и не убавляет. */
  total: number;
  /** Незакрытые задачи состава — то, что мешает закрыть фазу. */
  open: IndexRecord[];
}

const STARTED = new Set(['in_progress', 'in_review', 'done']);
const CLOSED = new Set(['done', 'dropped']);

export function phaseProgress(phase: IndexRecord, records: readonly IndexRecord[]): PhaseProgress {
  const covered = new Set(phase.links.covers ?? []);
  // Связь ставят с любой из двух сторон — показываем одно множество, как
  // «что проверяет» у Проверок.
  const tasks = records
    .filter((record) => record.type === 'task' && (covered.has(record.id) || record.phase === phase.id))
    .sort((a, b) => a.id.localeCompare(b.id));

  const counted = tasks.filter((task) => task.status !== 'dropped');
  return {
    phase,
    tasks,
    state: phaseState(tasks),
    done: counted.filter((task) => task.status === 'done').length,
    total: counted.length,
    open: tasks.filter((task) => !CLOSED.has(task.status))
  };
}

/**
 * `done` — всё закрыто или отменено и хотя бы одна закрыта: фаза, где всё
 * отменили, ничего не сделала. `active` — хоть одна начата. Иначе `planned`,
 * в том числе когда состава нет вовсе.
 */
export function phaseState(tasks: readonly { status: string }[]): PhaseState {
  if (tasks.some((task) => task.status === 'done') && tasks.every((task) => CLOSED.has(task.status))) return 'done';
  if (tasks.some((task) => STARTED.has(task.status))) return 'active';
  return 'planned';
}
