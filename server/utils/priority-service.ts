import { applyFieldPatch, applyJournalNote } from '../lib/actions';
import { dropCache } from '../lib/cache';
import { normalizeRoot } from '../lib/paths';
import type { PriorityPhase } from '../lib/prompt';
import type { IndexRecord, LinkKind } from '../lib/types';
import { membersOf, normalizePlan, rankOf, sortPhases, type PriorityPlan } from '../lib/work-order';
import { buildProjectMap } from './map-service';
import { loadIndex } from './index-service';
import { openRecord, today, writeRecord } from './record-write';

/**
 * Порядок по важности (docs/04-ui.md, «Порядок по важности»): данные для запроса и
 * запись подтверждённого порядка в файлы фаз.
 */

/** Что мешает задаче начаться: коды нарушений, о которых человеку стоит знать при расстановке. */
const BLOCKER_CODES = new Set(['task_not_ready_docs', 'task_maps_unapproved', 'task_no_requirement']);

export function priorityInput(root: string): { vision: string; phases: PriorityPhase[] } {
  const normalized = normalizeRoot(root);
  const index = loadIndex(normalized);
  const records = index.records;
  const byId = new Map(records.map((record) => [record.id, record]));

  const blockers = new Map<string, string[]>();
  for (const issue of index.issues) {
    if (!issue.recordId || !BLOCKER_CODES.has(issue.code)) continue;
    blockers.set(issue.recordId, [...(blockers.get(issue.recordId) ?? []), issue.message.replace(/\s+/g, ' ').slice(0, 140)]);
  }

  const taskLine = (task: IndexRecord) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    change: typeof task.extra['change'] === 'string' ? (task.extra['change'] as string) : '',
    requirement: (task.links.implements ?? []).map((id) => `${id} «${byId.get(id)?.title ?? ''}»`).join(', '),
    dependsOn: task.links.depends_on ?? [],
    blockers: blockers.get(task.id) ?? []
  });

  const phases = sortPhases(records.filter((record) => record.type === 'phase'), rankOf, 'importance')
    .map((phase) => ({ id: phase.id, title: phase.title, tasks: membersOf(phase, records).map(taskLine) }));

  const vision = buildProjectMap(normalized).functional.vision;
  const text = vision ? [vision.problem, vision.outcome ? `Успех: ${vision.outcome}` : '', vision.not ? `Не делает: ${vision.not}` : ''].filter(Boolean).join('\n') : '';
  return { vision: text, phases };
}

/** Связи записи изменяемым объектом: правка полей заменяет `links` целиком. */
function copyLinks(links: Readonly<Partial<Record<LinkKind, readonly string[]>>>): Partial<Record<LinkKind, string[]>> {
  return Object.fromEntries(Object.entries(links).map(([kind, ids]) => [kind, [...(ids ?? [])]]));
}

export interface ApplyResult {
  ok: true;
  changed: string[];
}

export type ApplyOutcome = ApplyResult | { ok: false; code: string; message: string };

/**
 * Записывает подтверждённый человеком порядок: каждой фазе — `rank` по месту в списке и
 * `covers` в новом порядке, строка в журнал. План сперва проходит ту же проверку, что и
 * ответ модели: неизвестное — отказ целиком, пропущенное достраивается, зависимости целы.
 */
export function applyPriority(root: string, plan: PriorityPlan, actor: string): ApplyOutcome {
  const normalized = normalizeRoot(root);
  const records = loadIndex(normalized).records;
  const known = new Set(records.map((record) => record.id));
  for (const phase of plan.phases) {
    if (!known.has(phase.id)) return { ok: false, code: 'phase_unknown', message: `Фазы \`${phase.id}\` в проекте нет: порядок не записан` };
    for (const task of phase.tasks) {
      if (!known.has(task.id)) return { ok: false, code: 'task_unknown', message: `Задачи \`${task.id}\` в проекте нет: порядок не записан` };
    }
  }

  const checked = normalizePlan(plan, records).plan;
  const stamp = today();
  const changed: string[] = [];

  for (const [at, phase] of checked.phases.entries()) {
    const context = openRecord(normalized, phase.id);
    if (!context) return { ok: false, code: 'phase_unknown', message: `Фаза ${phase.id} пропала во время записи` };

    const covers = phase.tasks.map((task) => task.id);
    const patched = applyFieldPatch(context.original, { rank: at + 1, links: { ...copyLinks(context.record.links), covers } }, stamp);
    const same = patched.text === context.original;
    if (same) continue;
    const written = writeRecord(context, patched, normalized);
    if (!written.ok) return { ok: false, code: 'write_refused', message: `Запись ${phase.id} отменена: ${written.problems.join(' ')}` };

    const again = openRecord(normalized, phase.id);
    if (again) {
      const note = applyJournalNote(again.original, { action: 'порядок по важности обновлён', actor, today: stamp });
      writeRecord(again, note, normalized);
    }
    changed.push(phase.id);
  }

  dropCache(normalized);
  return { ok: true, changed };
}
