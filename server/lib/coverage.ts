import {
  COVERAGE_LABEL,
  COVERAGE_LEVELS,
  IMPL_LABEL,
  childrenIndex,
  consistencyFlags,
  leavesUnder,
  statesOf,
  type CapabilityCoverage,
  type CapabilityLike,
  type CoverageLevel
} from './functional';
import { approvedMaps, foldMaps, parseMapRecord, type MapChange } from './maps';
import { RETIRED_STATUSES, type VerificationResult, type WorkRecord } from './types';

/**
 * Покрытие процессом: что стоит за возможностью в проекте — требования, задачи,
 * проверки и код (docs/07-maps.md, «Покрытие процессом»). Полей у возможности для
 * этого нет: цепочка идёт по связям, которые в записях уже есть, поэтому и
 * расчёт — чистая функция над записями, без файловой системы.
 */

// Модель покрытия живёт в functional.ts (её читает и экран); здесь — только расчёт по записям.
export { COVERAGE_LABEL, COVERAGE_LEVELS, consistencyFlags };
export type { CapabilityCoverage, CoverageLevel };

export interface CoverageInput {
  capabilities: readonly CapabilityLike[];
  records: readonly WorkRecord[];
  verifications: ReadonlyMap<string, VerificationResult>;
  groups?: readonly { id: string; capability?: string | undefined; modules: number }[];
}

const ACTIVE_TASK = new Set(['in_progress', 'in_review']);

/** Какие карты объявляли каждую возможность: по `added.capabilities`, без отставленных. */
export function mapsDeclaring(records: readonly WorkRecord[]): Map<string, string[]> {
  const declared = new Map<string, string[]>();
  for (const record of records) {
    if (record.type !== 'map' || !record.id || RETIRED_STATUSES.has(record.status)) continue;
    for (const item of parseMapRecord(record.body).change.functional?.added?.capabilities ?? []) {
      declared.set(item.id, [...(declared.get(item.id) ?? []), record.id]);
    }
  }
  return declared;
}

/** Что нашлось за одной возможностью: записи, а не счёт — у родителя их надо сложить без двойного счёта. */
interface Trace {
  maps: Set<string>;
  tasks: Map<string, WorkRecord>;
  requirements: Map<string, WorkRecord>;
  checks: Set<string>;
}

/**
 * Покрытие каждой возможности. Нижняя считается по цепочке «карта → задача →
 * требование → проверка»; у родителя — по его нижним возможностям и по картам,
 * что объявили его самого, **без двойного счёта**: одна задача карты, объявившей
 * десяток подпунктов, у родителя одна, а не десять.
 */
export function capabilityCoverage(input: CoverageInput): Map<string, CapabilityCoverage> {
  const declared = mapsDeclaring(input.records);
  const live = input.records.filter((record) => record.id && !RETIRED_STATUSES.has(record.status));
  const byId = new Map(live.map((record) => [record.id, record]));
  const tasks = live.filter((record) => record.type === 'task');
  const verificationsOf = (record: WorkRecord): string[] => [
    ...(record.links.verified_by ?? []),
    // Связь пишется в одну сторону; обратную видно по `verifies` у самой проверки.
    ...live.filter((other) => other.type === 'verification' && (other.links.verifies ?? []).includes(record.id)).map((other) => other.id)
  ];

  const traceOf = (id: string): Trace => {
    const maps = new Set(declared.get(id) ?? []);
    const mine = tasks.filter((task) => (task.links.affects ?? []).some((map) => maps.has(map)));
    const requirements = [...new Set(mine.flatMap((task) => task.links.implements ?? []))]
      .map((requirement) => byId.get(requirement))
      .filter((record): record is WorkRecord => !!record && record.type === 'requirement');
    const checks = [...new Set([...requirements, ...mine].flatMap(verificationsOf))]
      .filter((check) => byId.get(check)?.type === 'verification');
    return {
      maps,
      tasks: new Map(mine.map((task) => [task.id, task])),
      requirements: new Map(requirements.map((record) => [record.id, record])),
      checks: new Set(checks)
    };
  };

  const index = childrenIndex(input.capabilities);
  const capabilitiesById = new Map(input.capabilities.map((item) => [item.id, item]));
  const own = new Map(input.capabilities.map((item) => [item.id, traceOf(item.id)]));

  const result = new Map<string, CapabilityCoverage>();
  for (const capability of input.capabilities) {
    const sources = [own.get(capability.id) as Trace];
    if ((index.get(capability.id) ?? []).length > 0) {
      for (const leaf of leavesUnder(capability.id, index, capabilitiesById)) sources.push(own.get(leaf.id) as Trace);
    }
    const merged: Trace = {
      maps: new Set(sources.flatMap((source) => [...source.maps])),
      tasks: new Map(sources.flatMap((source) => [...source.tasks])),
      requirements: new Map(sources.flatMap((source) => [...source.requirements])),
      checks: new Set(sources.flatMap((source) => [...source.checks]))
    };

    const checks = [...merged.checks];
    const passed = checks.filter((check) => input.verifications.get(check) === 'passed').length;
    const failed = checks.filter((check) => input.verifications.get(check) === 'failed').length;
    const mine = [...merged.tasks.values()];
    const requirements = [...merged.requirements.values()];
    const code = (input.groups ?? [])
      .filter((group) => group.capability === capability.id)
      .map((group) => ({ group: group.id, modules: group.modules }));

    result.set(capability.id, {
      maps: [...merged.maps],
      requirements: {
        total: requirements.length,
        approved: requirements.filter((record) => record.status === 'approved').length,
        ids: requirements.map((record) => record.id),
        statuses: Object.fromEntries(requirements.map((record) => [record.id, record.status]))
      },
      tasks: {
        total: mine.length,
        done: mine.filter((task) => task.status === 'done').length,
        active: mine.filter((task) => ACTIVE_TASK.has(task.status)).length,
        ids: mine.map((task) => task.id),
        statuses: Object.fromEntries(mine.map((task) => [task.id, task.status]))
      },
      verifications: {
        passed,
        failed,
        unknown: checks.length - passed - failed,
        ids: checks,
        results: Object.fromEntries(checks.map((check) => [check, input.verifications.get(check) ?? 'none']))
      },
      code,
      level: levelOf(requirements.length + mine.length, checks.length, passed, failed)
    });
  }
  return result;
}

function levelOf(traces: number, checks: number, passed: number, failed: number): CoverageLevel {
  if (failed > 0) return 'failing';
  if (checks > 0) return passed === checks ? 'verified' : 'unchecked';
  return traces > 0 ? 'no_check' : 'none';
}

// --- расхождения отметки с тем, что за ней стоит ---

export type CapabilityFindingCode = 'capability_ahead' | 'capability_behind' | 'capability_verification_failed';

export interface CapabilityFinding {
  code: CapabilityFindingCode;
  capability: string;
  /** Карта, где возможность объявлена последней: отметку надо поправить или подтвердить там (`declaredBy`). */
  map: string;
  message: string;
}

/**
 * Три предупреждения (docs/05-validation.md): отметка опередила факт, отстала от
 * него или стоит там, где проверка падает. Читают только подтверждённые карты, а
 * у родителей не спрашивают — у них состояние производное. «Ни одна» и «все» —
 * потому что связь возможности с задачей точна только до карты: срабатываем на
 * очевидном, а не на одной задаче из десятка.
 */
export function capabilityFindings(
  records: readonly WorkRecord[],
  verifications: ReadonlyMap<string, VerificationResult>
): CapabilityFinding[] {
  const changes: { id: string; change: MapChange }[] = approvedMaps(records)
    .map((record) => ({ id: record.id, change: parseMapRecord(record.body).change }));
  const picture = foldMaps(changes);
  const capabilities: (CapabilityLike & { declaredBy?: string | undefined })[] = picture.functional.capabilities;
  if (capabilities.length === 0) return [];

  const index = childrenIndex(capabilities);
  const states = statesOf(capabilities);
  const coverage = capabilityCoverage({ capabilities, records, verifications });
  const found: CapabilityFinding[] = [];

  for (const item of capabilities) {
    if ((index.get(item.id) ?? []).length > 0 || !item.declaredBy) continue;
    const cover = coverage.get(item.id);
    if (!cover) continue;
    const status = states.get(item.id)?.status ?? null;
    const name = `«${item.title ?? item.id}» (\`${item.id}\`)`;
    const where = { capability: item.id, map: item.declaredBy };
    const flags = consistencyFlags(status, cover);

    if (flags.includes('ahead')) {
      found.push({
        code: 'capability_ahead',
        ...where,
        message: `Возможность ${name} отмечена «${IMPL_LABEL.implemented}», а ни одна из связанных задач не закрыта: ${cover.tasks.ids.join(', ')}. Отметка опередила факт — закройте задачу или поправьте отметку новой картой.`
      });
    }
    if (flags.includes('behind')) {
      found.push({
        code: 'capability_behind',
        ...where,
        message: `Все задачи возможности ${name} закрыты (${cover.tasks.ids.join(', ')}), а она «${status === null ? IMPL_LABEL.unrated : IMPL_LABEL.not_implemented}». Закрыта задача — отметьте возможность «${IMPL_LABEL.implemented}» или «${IMPL_LABEL.partial}» новой картой.`
      });
    }
    if (flags.includes('failing') && status) {
      const failed = cover.verifications.ids.filter((id) => verifications.get(id) === 'failed');
      found.push({
        code: 'capability_verification_failed',
        ...where,
        message: `Возможность ${name} отмечена «${IMPL_LABEL[status]}», а связанная проверка по последнему отчёту провалена: ${failed.join(', ')}.`
      });
    }
  }
  return found;
}
