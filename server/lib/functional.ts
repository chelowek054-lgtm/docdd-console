/**
 * Функциональная карта: состояние реализации и связи между возможностями
 * (docs/07-maps.md, «Состояние реализации», «Связи между возможностями»).
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

export const RELATION_TYPES = ['depends', 'uses', 'feeds'] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

export const RELATION_LABEL: Record<RelationType, string> = {
  depends: 'зависит от',
  uses: 'пользуется',
  feeds: 'передаёт данные в'
};

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
 * Дерево под фильтром: листья нужного состояния вместе с их предками — иначе
 * потеряется место в иерархии. Фильтра нет — всё как есть.
 */
export function filterByStatus<T extends CapabilityLike>(capabilities: readonly T[], filter: StatusFilter | null): T[] {
  if (!filter) return [...capabilities];
  const byId = new Map(capabilities.map((item) => [item.id, item]));
  const index = childrenIndex(capabilities);
  const keep = new Set<string>();
  for (const item of capabilities) {
    if ((index.get(item.id) ?? []).length > 0 || !matches(item, filter)) continue;
    let at: T | undefined = item;
    while (at && !keep.has(at.id)) {
      keep.add(at.id);
      const parent = parentOf(at, byId);
      at = parent ? byId.get(parent) : undefined;
    }
  }
  return capabilities.filter((item) => keep.has(item.id));
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

// --- пачка отметок: что сервер объявляет в черновике карты ---

export interface StatusItem {
  id: string;
  /** `null` — снять отметку. */
  status: ImplStatus | null;
  note?: string | undefined;
}

export interface StatusDeclarations {
  declarations: { id: string; title?: string; parent?: string; summary?: string; status?: ImplStatus; note?: string }[];
  /** id, которых нет в картине: ничего не записывается, пока они есть. */
  unknown: string[];
}

/**
 * Повторное объявление возможности — уточнение, побеждает последнее
 * (`foldMaps`), и поля, которых в нём нет, из возможности пропали бы. Поэтому
 * объявляем её целиком, меняя только `status` и `note`.
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
      ...(note ? { note } : {})
    });
  }
  return { declarations, unknown };
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
