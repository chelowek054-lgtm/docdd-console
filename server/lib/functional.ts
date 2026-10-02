/**
 * Функциональная карта: состояние реализации, приоритет, связи между
 * возможностями и то, что из них выводится (docs/07-maps.md, «Состояние
 * реализации», «Приоритет и горизонт», «Связи между возможностями»,
 * «Что дальше и что заденет»).
 * Чистые функции над списками возможностей — их зовут и сервер (разбор ответа
 * модели, пачка отметок), и экран (дерево, граф), поэтому правило одно и
 * считается в одном месте.
 */

const LF = String.fromCharCode(10);

export const IMPL_STATUSES = ['implemented', 'partial', 'not_implemented'] as const;
export type ImplStatus = (typeof IMPL_STATUSES)[number];

/** Слова на экране. «Не оценено» — не состояние, а отсутствие ответа: у него нет значения в карте. */
export const IMPL_LABEL: Record<ImplStatus | 'unrated', string> = {
  implemented: 'Реализовано',
  partial: 'Частично',
  not_implemented: 'Не реализовано',
  unrated: 'Не оценено'
};

export const RELATION_TYPES = ['depends', 'uses', 'feeds', 'triggers', 'replaces'] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

export const RELATION_LABEL: Record<RelationType, string> = {
  depends: 'зависит от',
  uses: 'пользуется',
  feeds: 'передаёт данные в',
  triggers: 'запускает',
  replaces: 'заменяет'
};

export const PRIORITIES = ['must', 'should', 'could', 'wont'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABEL: Record<Priority, string> = {
  must: 'Обязательно',
  should: 'Желательно',
  could: 'Можно',
  wont: 'Не берём'
};

export const HORIZONS = ['now', 'next', 'later'] as const;
export type Horizon = (typeof HORIZONS)[number];

export const HORIZON_LABEL: Record<Horizon, string> = {
  now: 'Сейчас',
  next: 'Следом',
  later: 'Потом'
};

export function isPriority(value: unknown): value is Priority {
  return typeof value === 'string' && (PRIORITIES as readonly string[]).includes(value);
}

export function isHorizon(value: unknown): value is Horizon {
  return typeof value === 'string' && (HORIZONS as readonly string[]).includes(value);
}

export function isImplStatus(value: unknown): value is ImplStatus {
  return typeof value === 'string' && (IMPL_STATUSES as readonly string[]).includes(value);
}

export function isRelationType(value: unknown): value is RelationType {
  return typeof value === 'string' && (RELATION_TYPES as readonly string[]).includes(value);
}

export interface CapabilityLike {
  id: string;
  title?: string | undefined;
  parent?: string | undefined;
  summary?: string | undefined;
  status?: string | undefined;
  note?: string | undefined;
  priority?: string | undefined;
  horizon?: string | undefined;
}

export interface RelationLike {
  from: string;
  to: string;
  type: string;
  summary?: string | undefined;
}

/** Родитель, найденный в этом же списке; осиротевшая ветка — корень, а не потеря. */
function parentOf(item: CapabilityLike, byId: ReadonlyMap<string, CapabilityLike>): string | null {
  return item.parent && item.parent !== item.id && byId.has(item.parent) ? item.parent : null;
}

export function childrenIndex<T extends CapabilityLike>(capabilities: readonly T[]): Map<string | null, T[]> {
  const byId = new Map(capabilities.map((item) => [item.id, item]));
  const index = new Map<string | null, T[]>();
  for (const item of capabilities) {
    const parent = parentOf(item, byId);
    index.set(parent, [...(index.get(parent) ?? []), item]);
  }
  return index;
}

/**
 * Приоритет и горизонт не складываются из подпунктов, как состояние: это
 * решение о ветке целиком. Поэтому действует собственное значение, а нет его —
 * значение ближайшего родителя, у которого оно есть (docs/07-maps.md,
 * «Приоритет и горизонт»).
 */
export interface Effective<T extends string> {
  value: T;
  /** Унаследовано от родителя — на экране такое приглушено. */
  inherited: boolean;
  /** У какой возможности значение записано. */
  from: string;
}

function effectiveOf<T extends string>(
  item: CapabilityLike,
  field: 'priority' | 'horizon',
  known: (value: unknown) => value is T,
  byId: ReadonlyMap<string, CapabilityLike>
): Effective<T> | null {
  const seen = new Set<string>();
  let at: CapabilityLike | undefined = item;
  while (at && !seen.has(at.id)) {
    seen.add(at.id);
    const value = at[field];
    if (known(value)) return { value, inherited: at.id !== item.id, from: at.id };
    const parent = parentOf(at, byId);
    at = parent ? byId.get(parent) : undefined;
  }
  return null;
}

export function effectivePriority(item: CapabilityLike, byId: ReadonlyMap<string, CapabilityLike>): Effective<Priority> | null {
  return effectiveOf(item, 'priority', isPriority, byId);
}

export function effectiveHorizon(item: CapabilityLike, byId: ReadonlyMap<string, CapabilityLike>): Effective<Horizon> | null {
  return effectiveOf(item, 'horizon', isHorizon, byId);
}

/** Нижние потомки возможности — те, у кого подпунктов нет. Сама возможность без подпунктов — свой единственный лист. */
export function leavesUnder<T extends CapabilityLike>(
  id: string,
  index: ReadonlyMap<string | null, readonly T[]>,
  byId: ReadonlyMap<string, T>
): T[] {
  const leaves: T[] = [];
  const seen = new Set<string>();
  const walk = (current: string) => {
    if (seen.has(current)) return;
    seen.add(current);
    const kids = index.get(current) ?? [];
    if (kids.length === 0) {
      const item = byId.get(current);
      if (item) leaves.push(item);
      return;
    }
    for (const kid of kids) walk(kid.id);
  };
  walk(id);
  return leaves;
}

export interface Progress {
  implemented: number;
  partial: number;
  not_implemented: number;
  unrated: number;
  total: number;
}

export function progressOf(leaves: readonly CapabilityLike[]): Progress {
  const progress: Progress = { implemented: 0, partial: 0, not_implemented: 0, unrated: 0, total: leaves.length };
  for (const leaf of leaves) {
    if (isImplStatus(leaf.status)) progress[leaf.status] += 1;
    else progress.unrated += 1;
  }
  return progress;
}

/**
 * Состояние родителя — производное от оценённых листьев: все реализованы —
 * реализовано, ни одного — не реализовано, иначе частично. Ни одного оценённого
 * листа — не оценено (`null`). Не оценённые листья в расчёт не идут.
 */
export function derivedStatus(progress: Progress): ImplStatus | null {
  const rated = progress.implemented + progress.partial + progress.not_implemented;
  if (rated === 0) return null;
  if (progress.implemented === rated) return 'implemented';
  if (progress.not_implemented === rated) return 'not_implemented';
  return 'partial';
}

export interface CapabilityState {
  /** `null` — не оценено. */
  status: ImplStatus | null;
  /** Есть только у родителя: счёт его нижних возможностей. */
  progress: Progress | null;
}

/** Состояние каждой возможности: у листа своё, у родителя — по листьям. */
export function statesOf(capabilities: readonly CapabilityLike[]): Map<string, CapabilityState> {
  const byId = new Map(capabilities.map((item) => [item.id, item]));
  const index = childrenIndex(capabilities);
  const states = new Map<string, CapabilityState>();
  for (const item of capabilities) {
    if ((index.get(item.id) ?? []).length === 0) {
      states.set(item.id, { status: isImplStatus(item.status) ? item.status : null, progress: null });
      continue;
    }
    const progress = progressOf(leavesUnder(item.id, index, byId));
    states.set(item.id, { status: derivedStatus(progress), progress });
  }
  return states;
}

/** Общий счёт по нижним возможностям всего дерева — для сводки над деревом. */
export function overallProgress(capabilities: readonly CapabilityLike[]): Progress {
  const index = childrenIndex(capabilities);
  return progressOf(capabilities.filter((item) => (index.get(item.id) ?? []).length === 0));
}

export type StatusFilter = ImplStatus | 'unrated';

/** Нижняя возможность подходит под фильтр. */
function matches(item: CapabilityLike, filter: StatusFilter): boolean {
  return filter === 'unrated' ? !isImplStatus(item.status) : item.status === filter;
}

/**
 * Дерево под фильтром: листья, подошедшие под условие, вместе с их предками —
 * иначе потеряется место в иерархии. Условия нет — всё как есть. Один приём на
 * все фильтры (состояние, приоритет, горизонт, «только риски»).
 */
export function filterLeaves<T extends CapabilityLike>(
  capabilities: readonly T[],
  keepLeaf: ((leaf: T) => boolean) | null
): T[] {
  if (!keepLeaf) return [...capabilities];
  const byId = new Map(capabilities.map((item) => [item.id, item]));
  const index = childrenIndex(capabilities);
  const keep = new Set<string>();
  for (const item of capabilities) {
    if ((index.get(item.id) ?? []).length > 0 || !keepLeaf(item)) continue;
    let at: T | undefined = item;
    while (at && !keep.has(at.id)) {
      keep.add(at.id);
      const parent = parentOf(at, byId);
      at = parent ? byId.get(parent) : undefined;
    }
  }
  return capabilities.filter((item) => keep.has(item.id));
}

/**
 * Дерево под фильтром по состоянию: листья нужного состояния вместе с их
 * предками — иначе потеряется место в иерархии. Фильтра нет — всё как есть.
 */
export function filterByStatus<T extends CapabilityLike>(capabilities: readonly T[], filter: StatusFilter | null): T[] {
  return filterLeaves(capabilities, filter ? (leaf) => matches(leaf, filter) : null);
}

/** Фильтр по приоритету и горизонту: эффективные значения, с наследованием от родителя. */
export interface PlanFilter {
  priority?: Priority | 'none' | null;
  horizon?: Horizon | 'none' | null;
}

export function planPredicate<T extends CapabilityLike>(
  capabilities: readonly T[],
  filter: PlanFilter
): ((leaf: T) => boolean) | null {
  if (!filter.priority && !filter.horizon) return null;
  const byId = new Map(capabilities.map((item) => [item.id, item]));
  return (leaf) => {
    if (filter.priority && (effectivePriority(leaf, byId)?.value ?? 'none') !== filter.priority) return false;
    if (filter.horizon && (effectiveHorizon(leaf, byId)?.value ?? 'none') !== filter.horizon) return false;
    return true;
  };
}

/** Несохранённые отметки поверх картины: что видит человек, пока не нажал «Сохранить». */
export interface Mark {
  /** `null` — снять отметку. */
  status: ImplStatus | null;
  note?: string | undefined;
}

export function withMarks<T extends CapabilityLike>(capabilities: readonly T[], marks: Readonly<Record<string, Mark>>): T[] {
  return capabilities.map((item) => {
    const mark = marks[item.id];
    if (!mark) return item;
    const { status: _status, note: _note, ...rest } = item;
    const note = mark.status === null ? undefined : (mark.note !== undefined ? mark.note : item.note);
    return {
      ...rest,
      ...(mark.status ? { status: mark.status } : {}),
      ...(note ? { note } : {})
    } as T;
  });
}

/**
 * Несохранённые связи — пачка на экране (docs/07-maps.md, «Связи — тоже
 * пачкой»): добавленные видны сразу, как несохранённые отметки состояния, а
 * убранные из картины уходят. Не записанное в карту живёт только здесь.
 */
export interface RelationMarks {
  add: RelationItem[];
  remove: { from: string; to: string; type: string }[];
}

export const NO_RELATION_MARKS: RelationMarks = { add: [], remove: [] };

export function relationMarkCount(marks: RelationMarks): number {
  return marks.add.length + marks.remove.length;
}

const marksKey = (relation: { from: string; to: string; type: string }) => `${relation.from}>${relation.to}:${relation.type}`;

/**
 * Отложить связь в пачку. Сняли отложенное убирание той же связи — это отмена,
 * а не запись; связь, что уже стоит в карте в точности такой, откладывать
 * нечего. Новая фраза у стоящей связи — уточнение: уходит в `add`.
 */
export function queueRelationAdd(
  marks: RelationMarks,
  relation: RelationItem,
  saved: readonly RelationLike[]
): RelationMarks {
  const key = marksKey(relation);
  const stands = saved.find((item) => marksKey(item) === key);
  const remove = marks.remove.filter((item) => marksKey(item) !== key);
  const add = marks.add.filter((item) => marksKey(item) !== key);
  if (stands && (stands.summary ?? '') === (relation.summary ?? '')) return { add, remove };
  return { add: [...add, relation], remove };
}

/**
 * Отложить убирание связи. Не сохранённая — просто выходит из пачки; стоящая в
 * карте — уходит в `remove` (в карте она останется, пока пачку не сохранят и не
 * подтвердят).
 */
export function queueRelationRemove(
  marks: RelationMarks,
  relation: { from: string; to: string; type: string },
  saved: readonly RelationLike[]
): RelationMarks {
  const key = marksKey(relation);
  const add = marks.add.filter((item) => marksKey(item) !== key);
  const queued = marks.remove.some((item) => marksKey(item) === key);
  const stands = saved.some((item) => marksKey(item) === key);
  return {
    add,
    remove: stands && !queued ? [...marks.remove, { from: relation.from, to: relation.to, type: relation.type }] : marks.remove
  };
}

export function withRelationMarks<T extends RelationLike>(
  relations: readonly T[],
  marks: RelationMarks
): (T & { unsaved?: boolean })[] {
  const key = (relation: { from: string; to: string; type: string }) => `${relation.from}>${relation.to}:${relation.type}`;
  const removed = new Set(marks.remove.map(key));
  const kept = relations.filter((relation) => !removed.has(key(relation)));
  const standing = new Map(kept.map((relation) => [key(relation), relation]));
  const result: (T & { unsaved?: boolean })[] = [...kept];
  for (const relation of marks.add) {
    const stands = standing.get(key(relation));
    // Та же связь с новой фразой — уточнение: старая строка заменяется, а не двоится.
    if (stands) result.splice(result.indexOf(stands as T & { unsaved?: boolean }), 1);
    result.push({ ...relation, unsaved: true } as unknown as T & { unsaved?: boolean });
  }
  return result;
}

/**
 * «Ждёт»: возможность не реализована, а та, от которой она зависит
 * (`depends`), тоже. Начинать с неё нет смысла — сначала зависимость.
 * Возвращает id → к чему привязана очередь.
 */
export function waitingOn(
  capabilities: readonly CapabilityLike[],
  relations: readonly RelationLike[]
): Map<string, string[]> {
  const states = statesOf(capabilities);
  const waiting = new Map<string, string[]>();
  for (const relation of relations) {
    if (relation.type !== 'depends') continue;
    const own = states.get(relation.from);
    const target = states.get(relation.to);
    if (!own || !target) continue;
    if (own.status === 'implemented' || target.status === 'implemented') continue;
    waiting.set(relation.from, [...new Set([...(waiting.get(relation.from) ?? []), relation.to])]);
  }
  return waiting;
}

/** Пары, которые зависят друг от друга по кругу (`depends`): по очереди их не сделать. */
export function dependsCycle(relations: readonly RelationLike[]): Set<string> {
  const graph = new Map<string, string[]>();
  for (const relation of relations) {
    if (relation.type !== 'depends') continue;
    graph.set(relation.from, [...(graph.get(relation.from) ?? []), relation.to]);
  }
  const reaches = (start: string, goal: string): boolean => {
    const seen = new Set<string>();
    const stack = [start];
    while (stack.length > 0) {
      const at = stack.pop() as string;
      if (at === goal) return true;
      if (seen.has(at)) continue;
      seen.add(at);
      stack.push(...(graph.get(at) ?? []));
    }
    return false;
  };
  const inCycle = new Set<string>();
  for (const [from, targets] of graph) {
    for (const to of targets) {
      if (from === to || reaches(to, from)) {
        inCycle.add(from);
        inCycle.add(to);
      }
    }
  }
  return inCycle;
}

// --- «опирается на»: одно правило для «Можно начинать», «Освободит» и влияния ---

/**
 * Связи, прочитанные в одну сторону: «A опирается на B». `depends` и `uses` —
 * от `from` к `to`; `feeds` и `triggers` — наоборот: то, что A передаёт или
 * запускает, потребляет B, значит, B опирается на A. `replaces` сюда не входит:
 * заменяемое и заменяющее друг друга не держат (docs/07-maps.md, «Связи между
 * возможностями»).
 */
export function reliesOnEdges(relations: readonly RelationLike[]): { a: string; b: string }[] {
  const edges: { a: string; b: string }[] = [];
  for (const relation of relations) {
    if (relation.type === 'depends' || relation.type === 'uses') edges.push({ a: relation.from, b: relation.to });
    else if (relation.type === 'feeds' || relation.type === 'triggers') edges.push({ a: relation.to, b: relation.from });
  }
  return edges;
}

/** Всё, что достижимо от `start` по рёбрам `next`, — без самого `start` и без зацикливания. */
function reach(start: string, next: ReadonlyMap<string, string[]>): Set<string> {
  const found = new Set<string>();
  const stack = [...(next.get(start) ?? [])];
  while (stack.length > 0) {
    const at = stack.pop() as string;
    if (at === start || found.has(at)) continue;
    found.add(at);
    stack.push(...(next.get(at) ?? []));
  }
  return found;
}

function adjacency(edges: readonly { a: string; b: string }[], reverse: boolean): Map<string, string[]> {
  const next = new Map<string, string[]>();
  for (const edge of edges) {
    const [from, to] = reverse ? [edge.b, edge.a] : [edge.a, edge.b];
    next.set(from, [...(next.get(from) ?? []), to]);
  }
  return next;
}

export interface Impact {
  /** На чём возможность стоит — по цепочке до конца. */
  reliesOn: string[];
  /** Что заденет её изменение — по цепочке до конца. */
  reliedOnBy: string[];
}

export function impactOf(id: string, relations: readonly RelationLike[], capabilities: readonly CapabilityLike[]): Impact {
  const ids = new Set(capabilities.map((item) => item.id));
  const edges = reliesOnEdges(relations).filter((edge) => ids.has(edge.a) && ids.has(edge.b));
  return {
    reliesOn: [...reach(id, adjacency(edges, false))],
    reliedOnBy: [...reach(id, adjacency(edges, true))]
  };
}

/**
 * «Освободит»: сколько не реализованных возможностей прямо или по цепочке
 * `depends` стоят за этой. Показывает узкое место — одна не сделанная основа и
 * семь ждущих.
 */
export function unblockCounts(
  capabilities: readonly CapabilityLike[],
  relations: readonly RelationLike[]
): Map<string, number> {
  const states = statesOf(capabilities);
  const edges = relations
    .filter((relation) => relation.type === 'depends' && states.has(relation.from) && states.has(relation.to))
    .map((relation) => ({ a: relation.from, b: relation.to }));
  const behind = adjacency(edges, true);
  const counts = new Map<string, number>();
  for (const item of capabilities) {
    if (states.get(item.id)?.status === 'implemented') continue;
    const waiting = [...reach(item.id, behind)].filter((other) => states.get(other)?.status !== 'implemented');
    if (waiting.length > 0) counts.set(item.id, waiting.length);
  }
  return counts;
}

export interface StartItem {
  id: string;
  priority: Priority | null;
  horizon: Horizon | null;
  /** Сколько не реализованных возможностей освободит эта. */
  unblocks: number;
}

export interface StartNow {
  items: StartItem[];
  /** Нижние возможности без оценки: их в список не берут, но число называют. */
  unrated: number;
}

const PRIORITY_RANK: Record<Priority | 'none', number> = { must: 0, should: 1, could: 2, none: 3, wont: 4 };
const HORIZON_RANK: Record<Horizon | 'none', number> = { now: 0, next: 1, later: 2, none: 3 };

/**
 * «Можно начинать» (docs/07-maps.md, «Что дальше и что заденет»): нижние
 * возможности «Не реализовано» и «Частично», которым ничто не мешает и приоритет
 * которых не «Не берём». Порядок: приоритет, горизонт, затем те, чья реализация
 * освободит больше других.
 */
export function startNow(capabilities: readonly CapabilityLike[], relations: readonly RelationLike[]): StartNow {
  const byId = new Map(capabilities.map((item) => [item.id, item]));
  const index = childrenIndex(capabilities);
  const waiting = waitingOn(capabilities, relations);
  const unblocks = unblockCounts(capabilities, relations);
  const items: StartItem[] = [];
  let unrated = 0;

  for (const item of capabilities) {
    if ((index.get(item.id) ?? []).length > 0) continue;
    const priority = effectivePriority(item, byId)?.value ?? null;
    if (priority === 'wont') continue;
    if (!isImplStatus(item.status)) {
      unrated += 1;
      continue;
    }
    if (item.status === 'implemented' || waiting.has(item.id)) continue;
    items.push({
      id: item.id,
      priority,
      horizon: effectiveHorizon(item, byId)?.value ?? null,
      unblocks: unblocks.get(item.id) ?? 0
    });
  }

  items.sort((x, y) => PRIORITY_RANK[x.priority ?? 'none'] - PRIORITY_RANK[y.priority ?? 'none']
    || HORIZON_RANK[x.horizon ?? 'none'] - HORIZON_RANK[y.horizon ?? 'none']
    || y.unblocks - x.unblocks
    || x.id.localeCompare(y.id));
  return { items, unrated };
}

/** У кого есть входящая `replaces`: id заменяемой → id заменяющих. */
export function replacedBy(relations: readonly RelationLike[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const relation of relations) {
    if (relation.type !== 'replaces') continue;
    result.set(relation.to, [...new Set([...(result.get(relation.to) ?? []), relation.from])]);
  }
  return result;
}

/** Связь между возможностью и её же предком — дерево это уже сказало, рисовать не надо. */
export function isTreeLink(a: string, b: string, capabilities: readonly CapabilityLike[]): boolean {
  const byId = new Map(capabilities.map((item) => [item.id, item]));
  const ancestorOf = (id: string, other: string): boolean => {
    const seen = new Set<string>();
    let at = byId.get(id);
    while (at && !seen.has(at.id)) {
      seen.add(at.id);
      const parent = parentOf(at, byId);
      if (!parent) return false;
      if (parent === other) return true;
      at = byId.get(parent);
    }
    return false;
  };
  return ancestorOf(a, b) || ancestorOf(b, a);
}

/** Какие связи можно нарисовать, а сколько пропущено — нет возможности на конце, либо связь с предком. */
export function drawableRelations<R extends RelationLike>(
  relations: readonly R[],
  capabilities: readonly CapabilityLike[]
): { drawn: R[]; skipped: number } {
  const ids = new Set(capabilities.map((item) => item.id));
  const drawn: R[] = [];
  let skipped = 0;
  for (const relation of relations) {
    if (!isRelationType(relation.type) || !ids.has(relation.from) || !ids.has(relation.to)
      || relation.from === relation.to || isTreeLink(relation.from, relation.to, capabilities)) {
      skipped += 1;
      continue;
    }
    drawn.push(relation);
  }
  return { drawn, skipped };
}

// --- уровни графа: обзор → группа → соседи выбранной (docs/04-ui.md, «Уровни графа») ---

/** Верхний предок возможности — её группа; сама возможность без родителя — группа сама себе. */
export function rootOf(id: string, capabilities: readonly CapabilityLike[]): string {
  const byId = new Map(capabilities.map((item) => [item.id, item]));
  const seen = new Set<string>();
  let at = byId.get(id);
  while (at && !seen.has(at.id)) {
    seen.add(at.id);
    const parent = parentOf(at, byId);
    if (!parent) return at.id;
    at = byId.get(parent);
  }
  return id;
}

export interface FunctionalGroup {
  id: string;
  title: string;
  progress: Progress;
  status: ImplStatus | null;
}

/** Связь между двумя группами одного вида: свёрнутые связи их потомков. */
export interface GroupEdge {
  from: string;
  to: string;
  type: RelationType;
  count: number;
  /** Хоть одна из свёрнутых связей — «ждёт». */
  waiting: boolean;
}

export interface GroupLevel {
  groups: FunctionalGroup[];
  edges: GroupEdge[];
  /** Группы, что зависят друг от друга по кругу (`depends`): на уровне возможностей этот цикл распылён. */
  cycle: Set<string>;
}

export function groupLevel(capabilities: readonly CapabilityLike[], relations: readonly RelationLike[]): GroupLevel {
  const index = childrenIndex(capabilities);
  const byId = new Map(capabilities.map((item) => [item.id, item]));
  const states = statesOf(capabilities);
  const roots = new Map<string, string>();
  for (const item of capabilities) roots.set(item.id, rootOf(item.id, capabilities));

  const groups: FunctionalGroup[] = [];
  for (const rootId of new Set(roots.values())) {
    const root = byId.get(rootId) as CapabilityLike;
    const progress = progressOf(leavesUnder(rootId, index, byId));
    groups.push({ id: rootId, title: root.title ?? rootId, progress, status: states.get(rootId)?.status ?? null });
  }

  const waiting = waitingOn(capabilities, relations);
  const folded = new Map<string, GroupEdge>();
  for (const relation of relations) {
    if (!isRelationType(relation.type)) continue;
    const from = roots.get(relation.from);
    const to = roots.get(relation.to);
    if (!from || !to || from === to) continue;
    const key = `${from}>${to}:${relation.type}`;
    const edge = folded.get(key) ?? { from, to, type: relation.type, count: 0, waiting: false };
    edge.count += 1;
    edge.waiting = edge.waiting || (waiting.get(relation.from) ?? []).includes(relation.to);
    folded.set(key, edge);
  }
  const edges = [...folded.values()];
  const cycle = dependsCycle(edges.filter((edge) => edge.type === 'depends'));
  return { groups, edges, cycle };
}

/** Что рисует открытая группа: её возможности и связи, у которых оба конца внутри. */
export function groupScopeOf<T extends CapabilityLike, R extends RelationLike>(
  capabilities: readonly T[],
  relations: readonly R[],
  rootId: string
): { capabilities: T[]; relations: R[] } {
  const inside = capabilities.filter((item) => rootOf(item.id, capabilities) === rootId);
  const ids = new Set(inside.map((item) => item.id));
  return {
    capabilities: inside,
    relations: relations.filter((relation) => ids.has(relation.from) && ids.has(relation.to))
  };
}

export interface FunctionalGhost {
  id: string;
  title: string;
  groupId: string;
  groupTitle: string;
  /** Связи с выбранной возможностью: `out` — от неё к призраку, `in` — от призрака к ней. */
  links: { direction: 'out' | 'in'; type: RelationType; summary?: string | undefined }[];
}

/** Больше стольких внешних соседей — они сворачиваются в узлы-группы, как у кодовой базы. */
export const FUNCTIONAL_GHOST_LIMIT = 12;

/**
 * Соседи выбранной возможности из **других групп**: пока она выбрана, они
 * показаны «призраками» со связями к ней (docs/04-ui.md, «Уровни графа»).
 */
export function functionalGhosts(
  capabilities: readonly CapabilityLike[],
  relations: readonly RelationLike[],
  rootId: string,
  selectedId: string
): FunctionalGhost[] {
  const byId = new Map(capabilities.map((item) => [item.id, item]));
  if (rootOf(selectedId, capabilities) !== rootId) return [];
  const ghosts = new Map<string, FunctionalGhost>();

  for (const relation of drawableRelations(relations, capabilities).drawn) {
    const outgoing = relation.from === selectedId;
    if (!outgoing && relation.to !== selectedId) continue;
    const otherId = outgoing ? relation.to : relation.from;
    const groupId = rootOf(otherId, capabilities);
    if (groupId === rootId) continue;
    const other = byId.get(otherId) as CapabilityLike;
    const ghost = ghosts.get(otherId) ?? {
      id: otherId,
      title: other.title ?? otherId,
      groupId,
      groupTitle: byId.get(groupId)?.title ?? groupId,
      links: []
    };
    ghost.links.push({ direction: outgoing ? 'out' : 'in', type: relation.type as RelationType, summary: relation.summary });
    ghosts.set(otherId, ghost);
  }
  return [...ghosts.values()];
}

// --- покрытие процессом: модель и признаки расхождения (docs/07-maps.md) ---
// Лежат здесь, а не в coverage.ts: экран читает их тоже, а coverage.ts тянет за
// собой разбор карт со схемами — в клиентскую сборку этому не место.

export const COVERAGE_LEVELS = ['failing', 'verified', 'unchecked', 'no_check', 'none'] as const;
export type CoverageLevel = (typeof COVERAGE_LEVELS)[number];

export const COVERAGE_LABEL: Record<CoverageLevel, string> = {
  failing: 'Проверка падает',
  verified: 'Подтверждено фактом',
  unchecked: 'Проверено не всё',
  no_check: 'Без проверки',
  none: 'Нет следа'
};

export interface CapabilityCoverage {
  /** Карты, объявлявшие возможность (не отставленные). */
  maps: string[];
  /** `statuses` — id → статус записи: карточке нужны не только числа, но и «T-0003 · done». */
  requirements: { total: number; approved: number; ids: string[]; statuses: Record<string, string> };
  tasks: { total: number; done: number; active: number; ids: string[]; statuses: Record<string, string> };
  /** `results` — id → результат последнего отчёта: `passed`, `failed`, `skipped` или `none` (прогонов не было). */
  verifications: { passed: number; failed: number; unknown: number; ids: string[]; results: Record<string, string> };
  /** Группы кодовой карты, назвавшие возможность своим `capability`, и число их модулей. */
  code: { group: string; modules: number }[];
  level: CoverageLevel;
}

export type ConsistencyFlag = 'ahead' | 'behind' | 'failing';

/**
 * Три расхождения нижней возможности — одно правило и для предупреждений, и для
 * режима «Риски» на экране: иначе экран и список нарушений разошлись бы.
 * `status` — отметка (`null` — не оценено). «Ни одна» и «все» — потому что связь
 * возможности с задачей точна только до карты (docs/07-maps.md).
 */
export function consistencyFlags(
  status: ImplStatus | null,
  cover: Pick<CapabilityCoverage, 'tasks' | 'verifications'> | undefined
): ConsistencyFlag[] {
  if (!cover) return [];
  const flags: ConsistencyFlag[] = [];
  if (status === 'implemented' && cover.tasks.total > 0 && cover.tasks.done === 0) flags.push('ahead');
  if ((status === null || status === 'not_implemented') && cover.tasks.total > 0 && cover.tasks.done === cover.tasks.total) {
    flags.push('behind');
  }
  if ((status === 'implemented' || status === 'partial') && cover.verifications.failed > 0) flags.push('failing');
  return flags;
}

// --- пачка отметок: что сервер объявляет в черновике карты ---

export interface StatusItem {
  id: string;
  /** `null` — снять отметку. */
  status: ImplStatus | null;
  note?: string | undefined;
}

export interface StatusDeclarations {
  declarations: {
    id: string; title?: string; parent?: string; summary?: string;
    status?: ImplStatus; note?: string; priority?: Priority; horizon?: Horizon;
  }[];
  /** id, которых нет в картине: ничего не записывается, пока они есть. */
  unknown: string[];
}

/**
 * Повторное объявление возможности — уточнение, побеждает последнее
 * (`foldMaps`), и поля, которых в нём нет, из возможности пропали бы. Поэтому
 * объявляем её целиком, меняя только `status` и `note` — приоритет и горизонт
 * остаются как были.
 */
export function statusDeclarations(
  capabilities: readonly CapabilityLike[],
  items: readonly StatusItem[]
): StatusDeclarations {
  const byId = new Map(capabilities.map((item) => [item.id, item]));
  const declarations: StatusDeclarations['declarations'] = [];
  const unknown: string[] = [];
  const done = new Set<string>();

  for (const item of items) {
    const current = byId.get(item.id);
    if (!current) {
      unknown.push(item.id);
      continue;
    }
    if (done.has(item.id)) continue;
    done.add(item.id);

    const note = item.status === null ? undefined : (item.note !== undefined ? item.note.trim() : current.note);
    declarations.push({
      id: current.id,
      ...(current.title ? { title: current.title } : {}),
      ...(current.parent ? { parent: current.parent } : {}),
      ...(current.summary ? { summary: current.summary } : {}),
      ...(item.status ? { status: item.status } : {}),
      ...(note ? { note } : {}),
      ...(isPriority(current.priority) ? { priority: current.priority } : {}),
      ...(isHorizon(current.horizon) ? { horizon: current.horizon } : {})
    });
  }
  return { declarations, unknown };
}

// --- пачка связей: что сервер объявляет и убирает одним черновиком ---

export interface RelationItem {
  from: string;
  to: string;
  type: RelationType;
  summary?: string | undefined;
}

export interface RelationPlan {
  add: RelationItem[];
  remove: { from: string; to: string; type: RelationType }[];
  /** Не ошибка: связь уже стоит или убирать нечего — в запись такое не идёт. */
  skipped: { from: string; to: string; type: string; reason: string }[];
  /** Ошибка пачки: хоть одна — отказ всей пачки, ничего не записывается. */
  problems: string[];
}

const relationKey = (relation: { from: string; to: string; type: string }) => `${relation.from}>${relation.to}:${relation.type}`;

/**
 * Пачка связей (docs/07-maps.md, «Связи — тоже пачкой»). Каждая добавляемая
 * проверяется, как одиночная: концы — две разные существующие возможности и не
 * предок с потомком. Наполовину принятая пачка хуже непринятой, поэтому хоть одна
 * ошибка — отказ всей.
 */
export function planRelations(
  capabilities: readonly CapabilityLike[],
  existing: readonly RelationLike[],
  add: readonly RelationItem[],
  remove: readonly { from: string; to: string; type: RelationType }[]
): RelationPlan {
  const plan: RelationPlan = { add: [], remove: [], skipped: [], problems: [] };
  const standing = new Map(existing.map((relation) => [relationKey(relation), relation]));
  const seen = new Set<string>();

  for (const relation of add) {
    const key = relationKey(relation);
    if (seen.has(key)) continue;
    seen.add(key);
    if (drawableRelations([relation], capabilities).drawn.length === 0) {
      plan.problems.push(`Связь «${relation.from}» → «${relation.to}» (${relation.type}): концы — две разные существующие возможности, и не предок с потомком`);
      continue;
    }
    const stands = standing.get(key);
    if (stands && (stands.summary ?? '') === (relation.summary ?? '')) {
      plan.skipped.push({ from: relation.from, to: relation.to, type: relation.type, reason: 'уже есть' });
      continue;
    }
    plan.add.push(relation);
  }

  for (const relation of remove) {
    const key = relationKey(relation);
    if (seen.has(`-${key}`)) continue;
    seen.add(`-${key}`);
    if (!standing.has(key)) {
      plan.skipped.push({ from: relation.from, to: relation.to, type: relation.type, reason: 'такой связи нет' });
      continue;
    }
    plan.remove.push(relation);
  }
  return plan;
}

// --- ответ «Предложить связи» ---

export interface RelationsResult {
  relations: RelationItem[];
  skipped: { from: string; to: string; type: string; reason: string }[];
}

const RELATIONS_BLOCK = /^[ \t]*(?:```|~~~)[ \t]*docdd-functional-relations[ \t]*\r?\n([\s\S]*?)^[ \t]*(?:```|~~~)[ \t]*$/m;

/**
 * Предложения модели — разбор, а не доверие: что не из карты, неизвестного вида,
 * связь с самой собой, с предком или уже стоящая — попадает в `skipped` с причиной,
 * а не пропадает молча. Блока нет или он не разбирается — `null`.
 */
export function parseFunctionalRelations(
  answer: string,
  capabilities: readonly CapabilityLike[],
  existing: readonly RelationLike[]
): RelationsResult | null {
  const match = RELATIONS_BLOCK.exec(answer);
  if (!match) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1] ?? '');
  } catch {
    return null;
  }
  const list = (parsed as { relations?: unknown } | null)?.relations;
  if (!Array.isArray(list)) return null;

  const ids = new Set(capabilities.map((item) => item.id));
  const standing = new Set(existing.map(relationKey));
  const taken = new Set<string>();
  const relations: RelationItem[] = [];
  const skipped: RelationsResult['skipped'] = [];

  for (const raw of list) {
    const entry = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const from = typeof entry['from'] === 'string' ? entry['from'].trim() : '';
    const to = typeof entry['to'] === 'string' ? entry['to'].trim() : '';
    const type = typeof entry['type'] === 'string' ? entry['type'].trim() : '';
    const summary = typeof entry['summary'] === 'string' ? entry['summary'].trim() : '';
    const said = { from: from || '(без from)', to: to || '(без to)', type: type || '(без type)' };

    const reason = !ids.has(from) || !ids.has(to) ? 'нет такой возможности'
      : !isRelationType(type) ? 'неизвестный вид'
        : from === to ? 'связь с самой собой'
          : isTreeLink(from, to, capabilities) ? 'родитель и подпункт'
            : standing.has(relationKey({ from, to, type })) ? 'уже есть'
              : taken.has(relationKey({ from, to, type })) ? 'повторяется в ответе'
                : null;
    if (reason) {
      skipped.push({ ...said, reason });
      continue;
    }
    taken.add(relationKey({ from, to, type }));
    relations.push({ from, to, type: type as RelationType, ...(summary ? { summary } : {}) });
  }
  return { relations, skipped };
}

/** Связи списком — для запроса «Предложить связи»: что уже стоит, того не повторять. */
export function relationLines(relations: readonly RelationLike[]): string {
  if (relations.length === 0) return 'Связей пока нет.';
  return relations
    .map((relation) => `- \`${relation.from}\` —${relation.type}→ \`${relation.to}\`${relation.summary ? ` (${relation.summary})` : ''}`)
    .join(LF);
}

// --- ответ «Проверить по коду» ---

export interface FunctionalCheckRow {
  id: string;
  title: string;
  /** Отметка в картине сейчас; `null` — не оценено. */
  current: ImplStatus | null;
  proposed: ImplStatus;
  note: string;
}

export interface FunctionalCheckResult {
  checks: FunctionalCheckRow[];
  skipped: { id: string; reason: string }[];
}

const CHECK_BLOCK = /^[ \t]*(?:```|~~~)[ \t]*docdd-functional-check[ \t]*\r?\n([\s\S]*?)^[ \t]*(?:```|~~~)[ \t]*$/m;

/**
 * Предложения модели — разбор, а не доверие: что не из карты, не из трёх
 * состояний или относится к родителю, попадает в `skipped` с причиной, а не
 * пропадает молча. Блока нет или он не разбирается — `null`: экран покажет
 * ответ текстом, как раньше.
 */
export function parseFunctionalCheck(
  answer: string,
  capabilities: readonly CapabilityLike[]
): FunctionalCheckResult | null {
  const match = CHECK_BLOCK.exec(answer);
  if (!match) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1] ?? '');
  } catch {
    return null;
  }
  const list = (parsed as { checks?: unknown } | null)?.checks;
  if (!Array.isArray(list)) return null;

  const byId = new Map(capabilities.map((item) => [item.id, item]));
  const index = childrenIndex(capabilities);
  const rows = new Map<string, FunctionalCheckRow>();
  const skipped: FunctionalCheckResult['skipped'] = [];

  for (const raw of list) {
    const entry = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const id = typeof entry['id'] === 'string' ? entry['id'].trim() : '';
    const capability = byId.get(id);
    if (!capability) {
      skipped.push({ id: id || '(без id)', reason: 'нет такой возможности' });
      continue;
    }
    if ((index.get(id) ?? []).length > 0) {
      skipped.push({ id, reason: 'у родителя состояние производное — оценивают нижние возможности' });
      continue;
    }
    if (!isImplStatus(entry['status'])) {
      skipped.push({ id, reason: 'состояние не из трёх: implemented, partial, not_implemented' });
      continue;
    }
    rows.set(id, {
      id,
      title: capability.title ?? id,
      current: isImplStatus(capability.status) ? capability.status : null,
      proposed: entry['status'],
      note: typeof entry['note'] === 'string' ? entry['note'].trim() : ''
    });
  }
  return { checks: [...rows.values()], skipped };
}

/**
 * Дерево с отступами и текущей отметкой — для запроса «Проверить по коду».
 * Отметка рядом с возможностью даёт модели то, от чего отталкиваться, а не
 * заставляет угадывать, что уже решено.
 */
export function capabilityLines(capabilities: readonly CapabilityLike[]): string {
  if (capabilities.length === 0) return 'Возможностей в карте пока нет.';
  const byId = new Map(capabilities.map((item) => [item.id, item]));
  const depthOf = (id: string, seen: ReadonlySet<string> = new Set()): number => {
    const item = byId.get(id);
    // Цикл в `parent` — та же защита, что и у отрисовки дерева на экране.
    if (!item?.parent || seen.has(id)) return 0;
    return 1 + depthOf(item.parent, new Set([...seen, id]));
  };
  return capabilities
    .map((item) => {
      const mark = isImplStatus(item.status) ? item.status : 'не оценено';
      const note = item.note ? `; ${item.note}` : '';
      return `${'  '.repeat(depthOf(item.id))}- \`${item.id}\`${item.title ? ` — ${item.title}` : ''} (${mark}${note})`;
    })
    .join(LF);
}
