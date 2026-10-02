import {
  HORIZON_LABEL,
  IMPL_LABEL,
  PRIORITY_LABEL,
  consistencyFlags,
  dependsCycle,
  effectiveHorizon,
  effectivePriority,
  impactOf,
  replacedBy,
  statesOf,
  unblockCounts,
  waitingOn,
  type CapabilityCoverage,
  type CapabilityLike,
  type ConsistencyFlag,
  type Effective,
  type Horizon,
  type ImplStatus,
  type Priority,
  type Progress,
  type RelationLike,
  type RelationType
} from '../../server/lib/functional';

/**
 * Что экран знает о возможности функциональной карты сверх её полей: производное
 * состояние, связи в обе стороны, «ждёт», цикл, приоритет, «освободит», влияние,
 * покрытие процессом и признаки риска (docs/07-maps.md, «Состояние реализации»,
 * «Связи между возможностями», «Покрытие процессом», «Что дальше и что заденет»).
 * Одно место на дерево, граф и карточку — иначе три экрана однажды заговорят о
 * состоянии по-разному.
 */

export interface CapabilityLink {
  direction: 'out' | 'in';
  type: RelationType;
  id: string;
  title: string;
  summary?: string | undefined;
  /** Связь ещё в несохранённой пачке. */
  unsaved?: boolean | undefined;
}

/** Признак риска нижней возможности: режим «Риски» и значки в дереве. */
export type RiskFlag = 'cycle' | 'waits' | ConsistencyFlag;

export interface CapabilityView {
  /** Состояние на экране: у листа своё, у родителя — по листьям; `null` — не оценено. */
  status: ImplStatus | null;
  /** Есть только у родителя: счёт его нижних возможностей. */
  progress: Progress | null;
  links: CapabilityLink[];
  /** Чего ждёт: id возможностей, от которых зависит и которые ещё не реализованы. */
  waiting: string[];
  /** Входит в цикл `depends`: ждёт ту, что ждёт её. */
  inCycle: boolean;
  /** Эффективные приоритет и горизонт: свои или унаследованные от родителя. */
  priority: Effective<Priority> | null;
  horizon: Effective<Horizon> | null;
  /** Кто её заменяет (входящая `replaces`). */
  replacedBy: string[];
  /** Сколько не реализованных возможностей стоят за ней по цепочке `depends`. */
  unblocks: number;
  /** Сколько возможностей лежит в цепочках «опирается на» и «на неё опираются». */
  reliesOn: number;
  reliedOnBy: number;
  /** Что стоит за отметкой в процессе; нет, пока покрытие не загружено. */
  coverage?: CapabilityCoverage | undefined;
  /** Признаки риска — только у нижних возможностей. */
  flags: RiskFlag[];
}

export function capabilityViews(
  capabilities: readonly CapabilityLike[],
  relations: readonly (RelationLike & { type: string; unsaved?: boolean })[],
  coverage?: Readonly<Record<string, CapabilityCoverage>>
): Map<string, CapabilityView> {
  const states = statesOf(capabilities);
  const waiting = waitingOn(capabilities, relations);
  const cycle = dependsCycle(relations);
  const unblocks = unblockCounts(capabilities, relations);
  const replaced = replacedBy(relations);
  const byId = new Map(capabilities.map((item) => [item.id, item]));
  const titleOf = new Map(capabilities.map((item) => [item.id, item.title ?? item.id]));
  const hasKids = new Set(capabilities.map((item) => item.parent).filter((id): id is string => !!id && byId.has(id)));

  const views = new Map<string, CapabilityView>();
  for (const item of capabilities) {
    const state = states.get(item.id);
    const impact = impactOf(item.id, relations, capabilities);
    const own = waiting.get(item.id) ?? [];
    const inCycle = cycle.has(item.id);
    const cover = coverage?.[item.id];
    const leaf = !hasKids.has(item.id);
    const flags: RiskFlag[] = leaf
      ? [
        ...(inCycle ? ['cycle' as const] : []),
        ...(own.length > 0 ? ['waits' as const] : []),
        ...consistencyFlags(state?.status ?? null, cover)
      ]
      : [];
    views.set(item.id, {
      status: state?.status ?? null,
      progress: state?.progress ?? null,
      links: [],
      waiting: own,
      inCycle,
      priority: effectivePriority(item, byId),
      horizon: effectiveHorizon(item, byId),
      replacedBy: replaced.get(item.id) ?? [],
      unblocks: unblocks.get(item.id) ?? 0,
      reliesOn: impact.reliesOn.length,
      reliedOnBy: impact.reliedOnBy.length,
      coverage: cover,
      flags
    });
  }

  for (const relation of relations) {
    if (!titleOf.has(relation.from) || !titleOf.has(relation.to)) continue;
    const type = relation.type as RelationType;
    views.get(relation.from)?.links.push({
      direction: 'out', type, id: relation.to, title: titleOf.get(relation.to) as string,
      summary: relation.summary, unsaved: relation.unsaved
    });
    views.get(relation.to)?.links.push({
      direction: 'in', type, id: relation.from, title: titleOf.get(relation.from) as string,
      summary: relation.summary, unsaved: relation.unsaved
    });
  }
  return views;
}

/** «Реализовано», «5 из 8 реализовано, 2 не оценено» — одна подпись на дерево и карточку. */
export function statusText(view: CapabilityView): string {
  const base = IMPL_LABEL[view.status ?? 'unrated'];
  const progress = view.progress;
  if (!progress) return base;
  const parts = [`${progress.implemented} из ${progress.total} реализовано`];
  if (progress.partial) parts.push(`${progress.partial} частично`);
  if (progress.unrated) parts.push(`${progress.unrated} не оценено`);
  return `${base}: ${parts.join(', ')}`;
}

/** «Обязательно», «Сейчас · Следом» — подпись приоритета и горизонта; пусто, если ни того ни другого. */
export function planText(view: CapabilityView): string {
  return [
    view.priority ? PRIORITY_LABEL[view.priority.value] : '',
    view.horizon ? HORIZON_LABEL[view.horizon.value] : ''
  ].filter(Boolean).join(' · ');
}

/** «задачи 3/5» — одним счётом, если за возможностью есть задачи. */
export function tasksText(cover: CapabilityCoverage | undefined): string {
  return cover && cover.tasks.total > 0 ? `задачи ${cover.tasks.done}/${cover.tasks.total}` : '';
}

/** Слова признаков риска — на узле режима «Риски», в дереве и в карточке. */
export const RISK_LABEL: Record<RiskFlag, string> = {
  cycle: 'цикл',
  waits: 'ждёт зависимость',
  failing: 'проверка падает',
  ahead: 'отметка опередила задачи',
  behind: 'задачи закрыты, отметки нет'
};

/** Худший из признаков: красный — цикл и падающая проверка, оранжевый — расхождение, жёлтый — «ждёт». */
export function riskLevel(flags: readonly RiskFlag[]): 'red' | 'orange' | 'yellow' | 'none' {
  if (flags.includes('cycle') || flags.includes('failing')) return 'red';
  if (flags.includes('ahead') || flags.includes('behind')) return 'orange';
  if (flags.includes('waits')) return 'yellow';
  return 'none';
}

/** Цвета состояния — одни на дерево, граф и сводку; слово и значок рядом, чтобы не опираться на один цвет. */
export const STATUS_STYLE: Record<ImplStatus | 'unrated', { fill: string; stroke: string; icon: string; text: string }> = {
  implemented: { fill: '#DCFCE7', stroke: '#16A34A', icon: 'i-lucide-check-circle-2', text: 'text-success' },
  partial: { fill: '#FEF3C7', stroke: '#D97706', icon: 'i-lucide-circle-dot', text: 'text-warning' },
  not_implemented: { fill: '#FEE2E2', stroke: '#DC2626', icon: 'i-lucide-circle-x', text: 'text-error' },
  unrated: { fill: '#F3F4F6', stroke: '#9CA3AF', icon: 'i-lucide-circle-dashed', text: 'text-muted' }
};
