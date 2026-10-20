import type { CapabilityLike } from './functional';
import type { IndexRecord } from './types';
import { joinRecord, splitRecord } from './write';

/**
 * Рабочее место менеджера (docs/15-team-platform.md, фаза 29). Чистые функции над
 * записями индекса: доска, дорожная карта, вехи, сводка и вопросы помощнику.
 * Ничего не хранится — всё считается из файлов проекта.
 */

export const BOARD_COLUMNS = ['backlog', 'ready', 'in_progress', 'in_review', 'done'] as const;

export const STATUS_WORD: Record<string, string> = {
  backlog: 'Очередь', ready: 'Готово к работе', in_progress: 'В работе', in_review: 'На приёмке', done: 'Сделано', dropped: 'Отменено'
};

export interface BoardFilter { phase?: string; assignee?: string; capability?: string }

function assigneeOf(record: IndexRecord): string {
  const value = record.extra['assignee'];
  return typeof value === 'string' ? value : '';
}

/** Задачи по колонкам; отменённые на доске не нужны — они не работа. */
export function boardColumns(records: readonly IndexRecord[], filter: BoardFilter = {}): Record<string, IndexRecord[]> {
  const columns: Record<string, IndexRecord[]> = Object.fromEntries(BOARD_COLUMNS.map((status) => [status, []]));
  const covered = new Map<string, string>();
  for (const record of records) {
    if (record.type === 'phase') for (const id of record.links.covers ?? []) covered.set(id, record.id);
  }
  for (const record of records) {
    if (record.type !== 'task') continue;
    const column = columns[record.status];
    if (!column) continue;
    const phase = record.phase ?? covered.get(record.id) ?? '';
    if (filter.phase && phase !== filter.phase) continue;
    if (filter.assignee && assigneeOf(record) !== filter.assignee) continue;
    if (filter.capability && !(record.links.affects ?? []).includes(filter.capability)) continue;
    column.push(record);
  }
  for (const list of Object.values(columns)) list.sort((a, b) => a.id.localeCompare(b.id));
  return columns;
}

export interface RoadmapPhase {
  id: string;
  title: string;
  rank: number | null;
  status: string;
  total: number;
  done: number;
  target: string | null;
  /** Дней просрочки вехи; 0 — не просрочена или фаза закончена. */
  overdueDays: number;
  /** Чужие незавершённые задачи, из-за которых фаза стоит: `depends_on` её задач. */
  blockedBy: { phase: string; task: string }[];
}

const DAY = 86_400_000;

export function overdueDays(target: string | null, today: string, finished: boolean): number {
  if (!target || finished) return 0;
  const gap = Date.parse(today) - Date.parse(target);
  return Number.isFinite(gap) && gap > 0 ? Math.floor(gap / DAY) : 0;
}

/** Целевая дата фазы: поле `target` в front matter (T-0034) — просто дата, без оценок задач. */
export function targetOf(record: IndexRecord): string | null {
  const value = record.extra['target'];
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : typeof value === 'string' ? value : '';
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null;
}

export function roadmap(records: readonly IndexRecord[], today: string): RoadmapPhase[] {
  const byId = new Map(records.map((record) => [record.id, record]));
  const phaseOfTask = new Map<string, string>();
  for (const record of records) {
    if (record.type === 'phase') for (const id of record.links.covers ?? []) phaseOfTask.set(id, record.id);
    if (record.type === 'task' && record.phase) phaseOfTask.set(record.id, record.phase);
  }
  return records
    .filter((record) => record.type === 'phase' && record.status !== 'dropped')
    .map((phase): RoadmapPhase => {
      const tasks = [...phaseOfTask]
        .filter(([, owner]) => owner === phase.id)
        .map(([id]) => byId.get(id))
        .filter((task): task is IndexRecord => !!task && task.status !== 'dropped');
      const done = tasks.filter((task) => task.status === 'done').length;
      const blockedBy: { phase: string; task: string }[] = [];
      for (const task of tasks) {
        for (const dep of task.links.depends_on ?? []) {
          const owner = phaseOfTask.get(dep);
          const blocker = byId.get(dep);
          if (owner && owner !== phase.id && blocker && blocker.status !== 'done' && blocker.status !== 'dropped') blockedBy.push({ phase: owner, task: dep });
        }
      }
      const rank = Number(phase.extra['rank']);
      const target = targetOf(phase);
      return {
        id: phase.id, title: phase.title, rank: Number.isFinite(rank) && rank > 0 ? rank : null, status: phase.status,
        total: tasks.length, done, target, overdueDays: overdueDays(target, today, tasks.length > 0 && done === tasks.length), blockedBy
      };
    })
    .sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || a.id.localeCompare(b.id));
}

/** Запись даты в `target`, остальное не трогаем: одна строка front matter. */
export function applyTarget(original: string, target: string | null): { text: string; problems: string[] } {
  const file = splitRecord(original);
  if (!file) return { text: original, problems: ['Файл не является записью с front matter.'] };
  if (target !== null && !/^\d{4}-\d{2}-\d{2}$/.test(target)) return { text: original, problems: ['Дата — ГГГГ-ММ-ДД.'] };
  const eol = file.eol === 'crlf' ? '\r\n' : '\n';
  const lines = file.frontMatter.split(/\r?\n/);
  const at = lines.findIndex((line) => /^target\s*:/.test(line));
  if (target === null) {
    if (at >= 0) lines.splice(at, 1);
  } else if (at >= 0) lines[at] = `target: ${target}`;
  else lines.push(`target: ${target}`);
  return { text: joinRecord({ ...file, frontMatter: lines.join(eol) }), problems: [] };
}

/** Сводка для заказчика простым языком (T-0035): без номеров процесса и статусов-жаргона. */
export function customerSummary(project: string, today: string, capabilities: readonly CapabilityLike[], phases: readonly RoadmapPhase[]): string {
  const leaves = capabilities.filter((item) => !capabilities.some((other) => other.parent === item.id));
  const list = (items: readonly CapabilityLike[]) => (items.length ? items.map((item) => `- ${item.title ?? item.id}`).join('\n') : '- пока ничего');
  const done = leaves.filter((item) => item.status === 'implemented');
  const doing = leaves.filter((item) => item.status === 'partial');
  const next = leaves.filter((item) => item.status !== 'implemented' && item.status !== 'partial' && item.horizon !== 'later');
  const share = leaves.length ? Math.round((done.length / leaves.length) * 100) : 0;
  const stages = phases.map((phase) => {
    const note = phase.overdueDays > 0 ? `, срок ${phase.target} прошёл` : phase.target ? `, срок ${phase.target}` : '';
    return `- ${phase.title}: сделано ${phase.done} из ${phase.total}${note}`;
  });
  return [
    `# ${project}: сводка на ${today}`, '',
    `Готово ${done.length} из ${leaves.length} возможностей (${share}%).`, '',
    '## Что готово', list(done), '',
    '## Что в работе', list(doing), '',
    '## Что следующее', list(next.slice(0, 10)), '',
    '## Этапы', stages.length ? stages.join('\n') : '- этапы ещё не заведены', ''
  ].join('\n');
}

export type AssistantQuestion = 'blockers' | 'changes' | 'plan';

/** Вопрос помощнику: данные подставлены в текст, инструменты модели не нужны. Ответ — черновик. */
export function assistantPrompt(question: AssistantQuestion, records: readonly IndexRecord[], today: string, sinceDays = 7): string {
  const road = roadmap(records, today);
  const tasks = records.filter((record) => record.type === 'task' && record.status !== 'dropped');
  const taskLine = (task: IndexRecord) => `- ${task.id} · ${task.title} · ${task.status}${task.links.depends_on?.length ? ` · зависит: ${task.links.depends_on.join(', ')}` : ''}`;
  const since = new Date(Date.parse(today) - sinceDays * DAY).toISOString().slice(0, 10);
  const phases = road.map((phase) => `- ${phase.id} · ${phase.title} · ${phase.done}/${phase.total}${phase.target ? ` · срок ${phase.target}` : ''}${phase.blockedBy.length ? ` · ждёт: ${phase.blockedBy.map((b) => b.task).join(', ')}` : ''}`).join('\n');
  const heads: Record<AssistantQuestion, string> = {
    blockers: 'Ты помогаешь менеджеру проекта. Назови, что блокирует работу: какие задачи стоят из-за чужих незавершённых задач и что снять первым. Коротко, списком, с номерами.',
    changes: `Ты помогаешь менеджеру проекта. Расскажи, что изменилось с ${since} (по полю updated): что сделано, что сдвинулось, что застряло. Коротко, списком, с номерами.`,
    plan: 'Ты помогаешь менеджеру проекта. Предложи черновик плана ближайшей фазы: какие задачи брать и в каком порядке. Это черновик: порядок применит человек.'
  };
  const shown = question === 'changes' ? tasks.filter((task) => (task.updated ?? '') >= since) : tasks.filter((task) => task.status !== 'done');
  return [heads[question], 'Ничего не меняй в проекте и не читай файлы: данные ниже.', '', '## Фазы', phases || '- нет', '', '## Задачи', shown.map(taskLine).join('\n') || '- нет'].join('\n');
}
