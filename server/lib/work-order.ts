import type { IndexRecord } from './types';

/**
 * Порядок работы по важности (docs/04-ui.md, «Порядок по важности»;
 * docs/02-workspace-contract.md, «Порядок фаз»). Чистые функции над записями:
 * чтение порядка, который лежит в файлах (`rank` у фазы, порядок `covers`), и
 * проверка ответа модели — приложение не верит порядку на слово, а чинит то, что
 * нарушает зависимости.
 */

const CLOSED = new Set(['done', 'dropped']);

/** Место фазы по важности; нет — `null`: порядок по номеру. */
export function rankOf(phase: IndexRecord): number | null {
  const value = phase.extra['rank'];
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : null;
}

/** Хоть у одной фазы есть `rank` — порядок «по важности» есть, и он по умолчанию. */
export function hasRanks(records: readonly IndexRecord[]): boolean {
  return records.some((record) => record.type === 'phase' && rankOf(record) !== null);
}

/** Состав фазы: сперва в порядке `covers`, затем задачи, связанные только полем `phase`, по номеру. */
export function membersOf(phase: IndexRecord, records: readonly IndexRecord[]): IndexRecord[] {
  const tasks = records.filter((record) => record.type === 'task');
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const first = (phase.links.covers ?? []).map((id) => byId.get(id)).filter((task): task is IndexRecord => task !== undefined);
  const named = new Set(first.map((task) => task.id));
  const rest = tasks.filter((task) => task.phase === phase.id && !named.has(task.id)).sort((a, b) => a.id.localeCompare(b.id));
  return [...first, ...rest];
}

export type OrderMode = 'importance' | 'id';

/** Фазы в выбранном порядке; у «по важности» фазы без `rank` идут после тех, у кого он есть. */
export function sortPhases<T extends { id: string }>(phases: readonly T[], rankFor: (phase: T) => number | null, mode: OrderMode): T[] {
  const list = [...phases];
  if (mode === 'id') return list.sort((a, b) => a.id.localeCompare(b.id));
  return list.sort((a, b) => (rankFor(a) ?? Infinity) - (rankFor(b) ?? Infinity) || a.id.localeCompare(b.id));
}

/**
 * Задачи в выбранном порядке: по важности — по месту фазы, затем по месту в её составе;
 * задачи вне фаз — в конце, по номеру.
 */
export function sortTasks(tasks: readonly IndexRecord[], records: readonly IndexRecord[], mode: OrderMode): IndexRecord[] {
  const list = [...tasks];
  if (mode === 'id') return list.sort((a, b) => a.id.localeCompare(b.id));

  const position = new Map<string, number>();
  const phases = sortPhases(records.filter((record) => record.type === 'phase'), rankOf, 'importance');
  let at = 0;
  for (const phase of phases) {
    for (const task of membersOf(phase, records)) {
      if (!position.has(task.id)) position.set(task.id, at++);
    }
  }
  return list.sort((a, b) => (position.get(a.id) ?? Infinity) - (position.get(b.id) ?? Infinity) || a.id.localeCompare(b.id));
}

// --- ответ модели ---

export interface PlanTask {
  id: string;
  why: string;
}

export interface PlanPhase {
  id: string;
  why: string;
  tasks: PlanTask[];
}

export interface PriorityPlan {
  phases: PlanPhase[];
}

export interface ParsedPriority {
  plan: PriorityPlan;
  /** Что в ответе не взято и почему: молча терять нельзя. */
  problems: string[];
  /** Что приложение поправило само, чтобы порядок не нарушал зависимости. */
  fixed: string[];
}

const BLOCK = /```docdd-order\s*\n([\s\S]*?)```/;

/** Блок `docdd-order` в ответе; нет блока или он не разбирается — `null`: ответ остаётся текстом. */
export function parsePriority(answer: string, records: readonly IndexRecord[]): ParsedPriority | null {
  const match = BLOCK.exec(answer);
  if (!match) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1] ?? '');
  } catch {
    return null;
  }
  const list = (parsed as { phases?: unknown } | null)?.phases;
  if (!Array.isArray(list)) return null;

  const raw: PlanPhase[] = [];
  for (const item of list) {
    const entry = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const tasks = Array.isArray(entry['tasks']) ? entry['tasks'] : [];
    raw.push({
      id: typeof entry['id'] === 'string' ? entry['id'].trim() : '',
      why: typeof entry['why'] === 'string' ? entry['why'].trim() : '',
      tasks: tasks.map((task): PlanTask => {
        if (typeof task === 'string') return { id: task.trim(), why: '' };
        const value = (task && typeof task === 'object' ? task : {}) as Record<string, unknown>;
        return { id: typeof value['id'] === 'string' ? value['id'].trim() : '', why: typeof value['why'] === 'string' ? value['why'].trim() : '' };
      })
    });
  }
  return normalizePlan({ phases: raw }, records);
}

/** Ответ модели, приведённый к тому, что можно записать: известное, полное, с соблюдёнными зависимостями. */
export function normalizePlan(input: PriorityPlan, records: readonly IndexRecord[]): ParsedPriority {
  const problems: string[] = [];
  const fixed: string[] = [];
  const phasesById = new Map(records.filter((record) => record.type === 'phase').map((phase) => [phase.id, phase]));
  const tasksById = new Map(records.filter((record) => record.type === 'task').map((task) => [task.id, task]));
  const current = sortPhases([...phasesById.values()], rankOf, 'importance');

  // 1. Фазы: известные, без повторов; не названные — в хвост в прежнем порядке.
  const seenPhase = new Set<string>();
  const phases: PlanPhase[] = [];
  for (const phase of input.phases) {
    if (!phasesById.has(phase.id)) { problems.push(`Фаза \`${phase.id || '(без номера)'}\` не из проекта — пропущена.`); continue; }
    if (seenPhase.has(phase.id)) continue;
    seenPhase.add(phase.id);
    phases.push({ ...phase, tasks: [...phase.tasks] });
  }
  for (const phase of current) {
    if (seenPhase.has(phase.id)) continue;
    problems.push(`Фаза ${phase.id} не названа в ответе — поставлена в конец в прежнем порядке.`);
    phases.push({ id: phase.id, why: '', tasks: [] });
  }

  // 2. Задачи каждой фазы: только её состав, без повторов; пропущенные — в хвост; закрытое — в конец.
  const placed = new Set<string>();
  for (const phase of phases) {
    const members = membersOf(phasesById.get(phase.id) as IndexRecord, records);
    const memberIds = new Set(members.map((task) => task.id));
    const ordered: PlanTask[] = [];
    for (const task of phase.tasks) {
      if (!tasksById.has(task.id)) { problems.push(`Задача \`${task.id || '(без номера)'}\` не из проекта — пропущена.`); continue; }
      if (!memberIds.has(task.id)) { problems.push(`Задача ${task.id} не входит в состав ${phase.id} — пропущена.`); continue; }
      if (placed.has(task.id)) continue;
      placed.add(task.id);
      ordered.push(task);
    }
    for (const task of members) {
      if (placed.has(task.id)) continue;
      placed.add(task.id);
      problems.push(`Задача ${task.id} не названа в ответе — поставлена в конец ${phase.id} в прежнем порядке.`);
      ordered.push({ id: task.id, why: '' });
    }
    // Закрытое и отменённое — в конце своей фазы, остальное в порядке ответа.
    const open = ordered.filter((task) => !CLOSED.has(tasksById.get(task.id)?.status ?? ''));
    const closed = ordered.filter((task) => CLOSED.has(tasksById.get(task.id)?.status ?? ''));
    phase.tasks = [...open, ...closed];

    // 3. Зависимости внутри фазы — жёсткое условие: сперва то, от чего зависят.
    const inPhase = new Map(phase.tasks.map((task) => [task.id, task]));
    const done = new Set<string>();
    const out: PlanTask[] = [];
    const visiting = new Set<string>();
    const visit = (task: PlanTask) => {
      if (done.has(task.id) || visiting.has(task.id)) return;
      visiting.add(task.id);
      for (const dep of tasksById.get(task.id)?.links.depends_on ?? []) {
        const prerequisite = inPhase.get(dep);
        if (prerequisite && !done.has(dep)) {
          visit(prerequisite);
          if (phase.tasks.findIndex((item) => item.id === dep) > phase.tasks.findIndex((item) => item.id === task.id)) {
            fixed.push(`${dep} поставлена перед ${task.id}: ${task.id} зависит от неё.`);
          }
        }
      }
      visiting.delete(task.id);
      done.add(task.id);
      out.push(task);
    };
    for (const task of phase.tasks) visit(task);
    phase.tasks = out;
  }

  // 4. Зависимости между фазами: фаза с «основанием» не может стоять позже зависимой от неё.
  const phaseOf = new Map<string, string>();
  for (const phase of phases) for (const task of phase.tasks) phaseOf.set(task.id, phase.id);
  const before = new Map<string, Set<string>>();
  for (const [taskId, phaseId] of phaseOf) {
    for (const dep of tasksById.get(taskId)?.links.depends_on ?? []) {
      const depPhase = phaseOf.get(dep);
      if (depPhase && depPhase !== phaseId) (before.get(phaseId) ?? before.set(phaseId, new Set()).get(phaseId) as Set<string>).add(depPhase);
    }
  }
  const sorted: PlanPhase[] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const byPhaseId = new Map(phases.map((phase) => [phase.id, phase]));
  const placePhase = (phase: PlanPhase) => {
    if (state.get(phase.id) === 'done') return;
    if (state.get(phase.id) === 'visiting') { problems.push(`Фазы ${phase.id} и те, на которые она опирается, зависят друг от друга по кругу — порядок между ними оставлен как в ответе.`); return; }
    state.set(phase.id, 'visiting');
    for (const dep of before.get(phase.id) ?? []) {
      const prerequisite = byPhaseId.get(dep);
      if (prerequisite && state.get(dep) !== 'done') {
        placePhase(prerequisite);
        if (phases.findIndex((item) => item.id === dep) > phases.findIndex((item) => item.id === phase.id)) {
          fixed.push(`Фаза ${dep} поставлена перед ${phase.id}: задачи ${phase.id} зависят от задач ${dep}.`);
        }
      }
    }
    state.set(phase.id, 'done');
    sorted.push(phase);
  };
  for (const phase of phases) placePhase(phase);

  return { plan: { phases: sorted }, problems, fixed };
}
