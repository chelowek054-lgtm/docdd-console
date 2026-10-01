import {
  IMPL_LABEL,
  dependsCycle,
  statesOf,
  waitingOn,
  type CapabilityLike,
  type ImplStatus,
  type Progress,
  type RelationLike,
  type RelationType
} from '../../server/lib/functional';

/**
 * Что экран знает о возможности функциональной карты сверх её полей: производное
 * состояние, связи в обе стороны, «ждёт», цикл (docs/07-maps.md, «Состояние
 * реализации», «Связи между возможностями»). Одно место на дерево, граф и
 * карточку — иначе три экрана однажды заговорят о состоянии по-разному.
 */

export interface CapabilityLink {
  direction: 'out' | 'in';
  type: RelationType;
  id: string;
  title: string;
  summary?: string | undefined;
}

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
}

export function capabilityViews(
  capabilities: readonly CapabilityLike[],
  relations: readonly (RelationLike & { type: string })[]
): Map<string, CapabilityView> {
  const states = statesOf(capabilities);
  const waiting = waitingOn(capabilities, relations);
  const cycle = dependsCycle(relations);
  const titleOf = new Map(capabilities.map((item) => [item.id, item.title ?? item.id]));

  const views = new Map<string, CapabilityView>();
  for (const item of capabilities) {
    const state = states.get(item.id);
    views.set(item.id, {
      status: state?.status ?? null,
      progress: state?.progress ?? null,
      links: [],
      waiting: waiting.get(item.id) ?? [],
      inCycle: cycle.has(item.id)
    });
  }

  for (const relation of relations) {
    if (!titleOf.has(relation.from) || !titleOf.has(relation.to)) continue;
    const type = relation.type as RelationType;
    views.get(relation.from)?.links.push({
      direction: 'out', type, id: relation.to, title: titleOf.get(relation.to) as string, summary: relation.summary
    });
    views.get(relation.to)?.links.push({
      direction: 'in', type, id: relation.from, title: titleOf.get(relation.from) as string, summary: relation.summary
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

/** Цвета состояния — одни на дерево, граф и сводку; слово и значок рядом, чтобы не опираться на один цвет. */
export const STATUS_STYLE: Record<ImplStatus | 'unrated', { fill: string; stroke: string; icon: string; text: string }> = {
  implemented: { fill: '#DCFCE7', stroke: '#16A34A', icon: 'i-lucide-check-circle-2', text: 'text-success' },
  partial: { fill: '#FEF3C7', stroke: '#D97706', icon: 'i-lucide-circle-dot', text: 'text-warning' },
  not_implemented: { fill: '#FEE2E2', stroke: '#DC2626', icon: 'i-lucide-circle-x', text: 'text-error' },
  unrated: { fill: '#F3F4F6', stroke: '#9CA3AF', icon: 'i-lucide-circle-dashed', text: 'text-muted' }
};
