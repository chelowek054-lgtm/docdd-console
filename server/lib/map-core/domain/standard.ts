/**
 * Стандарт обозначений типа карты (A-0010, п. 4–6; R-0143): виды узлов и связей с формой, цветом и
 * линией; из него строится легенда и по нему судит линтер. Проект переопределяет стандарт по частям
 * (`extends`): названное меняется, остальное берётся из встроенного.
 */
export type NodeShape = 'rounded' | 'rect' | 'person' | 'cylinder' | 'queue' | 'package' | 'cloud' | 'hexagon' | 'note';
export type EdgeLine = 'solid' | 'dashed' | 'dotted';
export type EdgeHead = 'arrow' | 'open' | 'none';
/** `required` — подпись обязательна; `format` — обязательна и называет формат данных; `optional` — по желанию. */
export type EdgeLabel = 'required' | 'format' | 'optional';

export interface NodeKind {
  id: string;
  title: string;
  shape: NodeShape;
  /** Имя цветового токена (`map-…`), не цвет: цвет зависит от темы. */
  color: string;
  icon: string;
  /** Может ли быть родителем других узлов; вложенность в не-контейнер — предупреждение. */
  container?: boolean;
}

export interface EdgeKind {
  id: string;
  title: string;
  line: EdgeLine;
  head: EdgeHead;
  label: EdgeLabel;
  /** «Туда-обратно» одной связью: двойной наконечник. */
  twoWay?: boolean;
}

export interface StandardSource {
  name: string;
  /** Что из него взято. */
  note: string;
}

export interface MapStandard {
  template: string;
  title: string;
  /** Вопрос карты: куда, почему, как, что есть. */
  question: string;
  sources: StandardSource[];
  /** Что дописано своё, где признанного стандарта не хватило. */
  own: string[];
  nodeKinds: NodeKind[];
  edgeKinds: EdgeKind[];
  /** Вид узла, если в записи он не назван: у старых записей поля `kind` нет. */
  defaultNodeKind?: string;
  /** Вид связи, если не назван. */
  defaultEdgeKind?: string;
}

export interface StandardOverride {
  extends: string;
  title?: string;
  nodeKinds?: (Partial<NodeKind> & { id: string })[];
  edgeKinds?: (Partial<EdgeKind> & { id: string })[];
}

/** Переопределение по частям: вид с тем же id меняет только названные поля, новый вид добавляется целиком. */
export function mergeStandard(base: MapStandard, override: StandardOverride): { standard: MapStandard; problems: string[] } {
  const problems: string[] = [];
  const merge = <T extends { id: string }>(items: readonly T[], changes: readonly (Partial<T> & { id: string })[] | undefined, complete: (item: Partial<T>) => item is T, what: string): T[] => {
    const result = items.map((item) => ({ ...item }));
    for (const change of changes ?? []) {
      const at = result.findIndex((item) => item.id === change.id);
      if (at >= 0) result[at] = { ...result[at], ...change } as T;
      else if (complete(change)) result.push(change);
      else problems.push(`${what} «${change.id}»: нового вида нет во встроенном стандарте, а описан он не полностью`);
    }
    return result;
  };
  const standard: MapStandard = {
    ...base,
    ...(override.title ? { title: override.title } : {}),
    nodeKinds: merge(base.nodeKinds, override.nodeKinds, (item): item is NodeKind => Boolean(item.id && item.title && item.shape && item.color && item.icon), 'Вид узла'),
    edgeKinds: merge(base.edgeKinds, override.edgeKinds, (item): item is EdgeKind => Boolean(item.id && item.title && item.line && item.head && item.label), 'Вид связи')
  };
  return { standard, problems };
}

export interface LegendRow {
  kind: 'node' | 'edge';
  id: string;
  title: string;
  shape?: NodeShape;
  color?: string;
  icon?: string;
  line?: EdgeLine;
  head?: EdgeHead;
  twoWay?: boolean;
  label?: EdgeLabel;
}

/** Легенда — из стандарта, а не из кода компонента: новый шаблон не правит интерфейс. */
export function legendOf(standard: MapStandard): LegendRow[] {
  return [
    ...standard.nodeKinds.map((kind) => ({ kind: 'node' as const, id: kind.id, title: kind.title, shape: kind.shape, color: kind.color, icon: kind.icon })),
    ...standard.edgeKinds.map((kind) => ({ kind: 'edge' as const, id: kind.id, title: kind.title, line: kind.line, head: kind.head, label: kind.label, ...(kind.twoWay ? { twoWay: true } : {}) }))
  ];
}
