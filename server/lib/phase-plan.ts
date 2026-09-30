import type { ProposedRecord } from './inbox';
import type { IndexRecord } from './types';

/**
 * Разбиение задач на фазы (docs/04-ui.md, «Разбить на фазы»). Чистые функции:
 * какие задачи отдавать модели и что из её ответа можно завести. Номера и
 * файлы — дело вызывающего, как и у входящего.
 */

export interface PlannedPhase {
  key: string;
  title: string;
  body?: string;
  covers: string[];
}

export interface PhasePlan {
  phases: PlannedPhase[];
  /** Задачи набора, не попавшие ни в одну фазу: потеря называется, а не замалчивается. */
  uncovered: string[];
  problems: string[];
}

/** Задачи, уже состоящие в какой-то фазе: по `covers` фазы или по полю `phase` у самой. */
export function phasedTaskIds(records: readonly IndexRecord[]): Set<string> {
  const phased = new Set<string>();
  for (const record of records) {
    if (record.type === 'phase') {
      for (const id of record.links.covers ?? []) phased.add(id);
    } else if (record.type === 'task' && record.phase) {
      phased.add(record.id);
    }
  }
  return phased;
}

/**
 * Что отдавать модели: не отменённые задачи, которых нет ни в одной фазе.
 * Отмеченные, но неподходящие, отбрасываются — считает сервер, а не экран.
 */
export function phaseCandidates(records: readonly IndexRecord[], picked?: readonly string[]): IndexRecord[] {
  const phased = phasedTaskIds(records);
  const chosen = picked && picked.length > 0 ? new Set(picked) : null;
  return records
    .filter((record) => record.type === 'task' && record.status !== 'dropped')
    .filter((record) => !phased.has(record.id))
    .filter((record) => chosen === null || chosen.has(record.id))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Почему задача не годится в новую фазу: слова для человека. */
function whyNot(id: string, records: readonly IndexRecord[], phased: ReadonlySet<string>): string {
  const record = records.find((item) => item.id === id);
  if (!record) return `\`${id}\` — такой записи в проекте нет`;
  if (record.type !== 'task') return `\`${id}\` — не задача`;
  if (record.status === 'dropped') return `${id} отменена`;
  if (phased.has(id)) return `${id} уже состоит в фазе`;
  return `${id} не входит в набор, отданный модели`;
}

/**
 * Предложение модели (или список, правленный человеком) — в фазы, которые
 * можно завести. Берутся только записи `phase`; из состава снимается всё, что
 * не годится; задача, названная дважды, остаётся в первой фазе; фаза без
 * состава не заводится.
 */
export function planPhases(
  proposed: readonly ProposedRecord[],
  records: readonly IndexRecord[],
  scope?: readonly string[]
): PhasePlan {
  const allowed = new Set(phaseCandidates(records, scope).map((task) => task.id));
  const phased = phasedTaskIds(records);
  const taken = new Set<string>();
  const phases: PlannedPhase[] = [];
  const problems: string[] = [];

  for (const record of proposed) {
    const name = record.title || record.key;
    if (record.type !== 'phase') {
      problems.push(`Запись «${name}» не типа \`phase\` — пропущена.`);
      continue;
    }
    if (record.title.trim() === '') {
      problems.push(`Фаза \`${record.key}\` без названия — пропущена.`);
      continue;
    }

    const covers: string[] = [];
    for (const id of record.links?.['covers'] ?? []) {
      if (taken.has(id)) {
        problems.push(`Фаза «${name}»: ${id} уже в предыдущей фазе — оставлена в ней.`);
      } else if (!allowed.has(id)) {
        problems.push(`Фаза «${name}»: ${whyNot(id, records, phased)} — снята из состава.`);
      } else {
        taken.add(id);
        covers.push(id);
      }
    }

    if (covers.length === 0) {
      problems.push(`Фаза «${name}» осталась без задач — не заводится.`);
      continue;
    }
    phases.push({
      key: record.key,
      title: record.title.trim(),
      ...(record.body ? { body: record.body } : {}),
      covers
    });
  }

  const uncovered = [...allowed].filter((id) => !taken.has(id)).sort();
  return { phases, uncovered, problems };
}

/** Фазы плана в виде, который принимает `createRecords`. */
export function asProposals(phases: readonly PlannedPhase[]): ProposedRecord[] {
  return phases.map((phase) => ({
    key: phase.key,
    type: 'phase',
    title: phase.title,
    ...(phase.body ? { body: phase.body } : {}),
    links: { covers: phase.covers }
  }));
}
