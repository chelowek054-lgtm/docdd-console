import { OTHER_GROUP, worstStatus, type Grouping } from './groups';
import type { Evidence, EvidenceVerdict } from './maps';

/**
 * Группы на потоках данных (docs/07-maps.md, «Потоки данных», «Группы и
 * здесь»). Своих групп у потоков нет: код берётся из групп кодовой карты, а
 * источники сворачиваются по `kind`. Чистые функции — их считает экран.
 */

/** Поток, у которого `from` — маршрут экрана, относится к этой группе. */
export const SCREENS_GROUP = 'Экраны';
/** Источник, которого карта не объявляла, — вид «не опознан». */
export const UNKNOWN_KIND = 'unknown';

export interface FlowSource {
  id: string;
  kind: string;
  title?: string | undefined;
  where?: string | undefined;
  declaredBy?: string | undefined;
  pending?: boolean | undefined;
}

export interface FlowItem {
  from: string;
  to: string;
  direction: string;
  evidence: Evidence;
  status?: EvidenceVerdict | undefined;
  declaredBy?: string | undefined;
  pending?: boolean | undefined;
}

export interface FlowContext {
  grouping: Grouping;
  /** Маршруты экранов пользовательской карты. */
  screens: ReadonlySet<string>;
  sources: ReadonlyMap<string, FlowSource>;
  /** Все модули групп — по ним `from` опознаётся как модуль. */
  members: ReadonlySet<string>;
}

export function flowContext(
  grouping: Grouping,
  screens: readonly { id: string }[],
  sources: readonly FlowSource[]
): FlowContext {
  return {
    grouping,
    screens: new Set(screens.map((screen) => screen.id)),
    sources: new Map(sources.map((source) => [source.id, source])),
    members: new Set(grouping.groups.flatMap((group) => group.members.map((member) => member.id)))
  };
}

/**
 * Группа кода у конца `from`: модуль — группа его модуля, экран — `Экраны`,
 * всё прочее — `Прочее`.
 */
export function codeGroupOf(from: string, context: FlowContext): string {
  if (context.members.has(from)) return context.grouping.groupOf(from);
  return context.screens.has(from) ? SCREENS_GROUP : OTHER_GROUP;
}

export function kindOf(to: string, context: FlowContext): string {
  return context.sources.get(to)?.kind ?? UNKNOWN_KIND;
}

export type FlowDirection = 'read' | 'write' | 'both';

/** `both`, если среди потоков есть `both` либо и `read`, и `write`. */
export function mergeDirections(directions: readonly string[]): FlowDirection {
  const set = new Set(directions);
  if (set.has('both') || (set.has('read') && set.has('write'))) return 'both';
  return set.has('write') ? 'write' : 'read';
}

export interface FlowLinkGroup {
  codeGroup: string;
  kind: string;
  flows: FlowItem[];
  direction: FlowDirection;
  /** По самому плохому из потоков — расхождение не растворяется в сумме. */
  status: EvidenceVerdict;
}

export interface FlowGrouping {
  /** Группы кода, у которых есть потоки. */
  codeGroups: { id: string; title: string; auto: boolean; flows: number }[];
  /** Виды источников, которых касаются потоки, и сколько источников каждого. */
  kinds: { kind: string; sources: number }[];
  links: FlowLinkGroup[];
}

export function groupFlows(flows: readonly FlowItem[], context: FlowContext): FlowGrouping {
  const collected = new Map<string, FlowLinkGroup>();
  const sourcesByKind = new Map<string, Set<string>>();
  const perGroup = new Map<string, number>();

  for (const flow of flows) {
    const codeGroup = codeGroupOf(flow.from, context);
    const kind = kindOf(flow.to, context);
    const key = `${codeGroup}>${kind}`;
    const link = collected.get(key) ?? { codeGroup, kind, flows: [], direction: 'read' as FlowDirection, status: 'ok' as EvidenceVerdict };
    link.flows.push(flow);
    collected.set(key, link);
    sourcesByKind.set(kind, (sourcesByKind.get(kind) ?? new Set()).add(flow.to));
    perGroup.set(codeGroup, (perGroup.get(codeGroup) ?? 0) + 1);
  }

  const links = [...collected.values()];
  for (const link of links) {
    link.direction = mergeDirections(link.flows.map((flow) => flow.direction));
    link.status = worstStatus(link.flows.map((flow) => ({ from: flow.from, to: flow.to, evidence: flow.evidence, status: flow.status })));
  }

  const titleOf = (id: string) => context.grouping.byId.get(id)?.title ?? id;
  return {
    codeGroups: [...perGroup].map(([id, count]) => ({
      id, title: titleOf(id), auto: context.grouping.byId.get(id)?.auto ?? true, flows: count
    })).sort((a, b) => a.title.localeCompare(b.title)),
    kinds: [...sourcesByKind].map(([kind, ids]) => ({ kind, sources: ids.size })).sort((a, b) => a.kind.localeCompare(b.kind)),
    links
  };
}

// --- вид группы кода ---

/** Что показать в группе кода: её потоки и источники, которых они касаются. */
export function codeGroupScope(
  context: FlowContext,
  groupId: string,
  flows: readonly FlowItem[]
): { flows: FlowItem[]; sources: FlowSource[] } {
  const own = flows.filter((flow) => codeGroupOf(flow.from, context) === groupId);
  const ids = new Set(own.map((flow) => flow.to));
  return { flows: own, sources: [...context.sources.values()].filter((source) => ids.has(source.id)) };
}

// --- вид источников одного вида ---

/** Источники одного вида и потоки к ним — из любых групп кода. */
export function kindScope(
  context: FlowContext,
  kind: string,
  flows: readonly FlowItem[]
): { flows: FlowItem[]; sources: FlowSource[] } {
  const own = flows.filter((flow) => kindOf(flow.to, context) === kind);
  const ids = new Set(own.map((flow) => flow.to));
  return { flows: own, sources: [...context.sources.values()].filter((source) => ids.has(source.id)) };
}

// --- соседи выбранного узла ---

export interface FlowGhost {
  /** id модуля/экрана или, у свёрнутого, `group:<id группы>`. */
  id: string;
  groupId: string;
  groupTitle: string;
  /** Свёрнутая группа соседей: сколько модулей за ней. */
  collapsed?: number;
}

/** Как у кодовой карты: больше стольких соседей — сворачиваются в узлы-группы. */
export const FLOW_GHOST_LIMIT = 12;

/**
 * «Призраки» выбранного узла в группе кода: чужие модули, которые трогают тот
 * же источник. Выбран модуль — берутся его источники; выбран источник — он сам.
 * Источник призраком не становится: он и есть содержание потока.
 */
export function flowGhosts(
  context: FlowContext,
  groupId: string,
  selectedId: string,
  flows: readonly FlowItem[]
): { ghosts: FlowGhost[]; flows: FlowItem[] } {
  const touched = context.sources.has(selectedId)
    ? new Set([selectedId])
    : new Set(flows.filter((flow) => flow.from === selectedId).map((flow) => flow.to));
  const outside = flows.filter((flow) => touched.has(flow.to) && codeGroupOf(flow.from, context) !== groupId);
  const distinct = [...new Set(outside.map((flow) => flow.from))];
  const titleOf = (id: string) => context.grouping.byId.get(id)?.title ?? id;

  if (distinct.length <= FLOW_GHOST_LIMIT) {
    return {
      ghosts: distinct.map((id) => {
        const gid = codeGroupOf(id, context);
        return { id, groupId: gid, groupTitle: titleOf(gid) };
      }),
      flows: outside
    };
  }

  const counts = new Map<string, Set<string>>();
  for (const id of distinct) {
    const key = codeGroupOf(id, context);
    counts.set(key, (counts.get(key) ?? new Set()).add(id));
  }
  return {
    ghosts: [...counts].map(([key, ids]) => ({
      id: `group:${key}`, groupId: key, groupTitle: titleOf(key), collapsed: ids.size
    })),
    flows: outside.map((flow) => ({ ...flow, from: `group:${codeGroupOf(flow.from, context)}` }))
  };
}
