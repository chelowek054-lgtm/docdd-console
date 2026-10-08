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

/** Фильтр списка фаз по готовности (docs/04-ui.md, «Фазы»). */
export type PhaseFilter = 'all' | 'open' | 'active' | 'planned' | 'done';

export const PHASE_FILTERS: readonly { value: PhaseFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'open', label: 'Не закрытые' },
  { value: 'active', label: 'В работе' },
  { value: 'planned', label: 'Не начатые' },
  { value: 'done', label: 'Закрытые' }
];

export function parsePhaseFilter(value: unknown): PhaseFilter {
  return PHASE_FILTERS.some((item) => item.value === value) ? (value as PhaseFilter) : 'all';
}

export function matchesPhaseFilter(state: PhaseState, filter: PhaseFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'open') return state !== 'done';
  return state === filter;
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

/** Доля сделанного: `done` из `total`, где `total` уже без отменённого. */
export interface Share {
  done: number;
  total: number;
}

export interface OverallProgress {
  tasks: Share;
  phases: Share;
}

/**
 * Две общие шкалы проекта (docs/04-ui.md, «Общие шкалы»): закрытые задачи из
 * всех неотменённых и закрытые фазы из всех. Считаются по всем записям, а не
 * по тому, что показано, — иначе фильтр экрана задач превратил бы готовность
 * проекта в долю выбранного.
 */
export function overallProgress(records: readonly IndexRecord[]): OverallProgress {
  const tasks = records.filter((record) => record.type === 'task' && record.status !== 'dropped');
  const phases = records.filter((record) => record.type === 'phase');
  return {
    tasks: { done: tasks.filter((task) => task.status === 'done').length, total: tasks.length },
    // Статус фазы расчётный: тот, что стоит в её файле, мнение, а не факт.
    phases: {
      done: phases.filter((phase) => phaseProgress(phase, records).state === 'done').length,
      total: phases.length
    }
  };
}

export function percent(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
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
