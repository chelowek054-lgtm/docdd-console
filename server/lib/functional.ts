/**
 * Состояние реализации возможностей функциональной карты
 * (docs/07-maps.md, «Состояние реализации»). Чистые функции над списком
 * возможностей: те же данные — тот же ответ, и экран, и сервер считают одним
 * кодом.
 */

export type CapabilityStatus = 'implemented' | 'partial' | 'not_implemented';

/** Состояние для показа: три отметки и «не оценено» — отсутствие отметки, а не значение. */
export type CapabilityState = CapabilityStatus | 'unassessed';

export const CAPABILITY_STATUSES: readonly CapabilityStatus[] = ['implemented', 'partial', 'not_implemented'];

export const STATE_ORDER: readonly CapabilityState[] = ['implemented', 'partial', 'not_implemented', 'unassessed'];

export const STATE_LABEL: Record<CapabilityState, string> = {
  implemented: 'Реализовано',
  partial: 'Частично',
  not_implemented: 'Не реализовано',
  unassessed: 'Не оценено'
};

export function isCapabilityStatus(value: unknown): value is CapabilityStatus {
  return typeof value === 'string' && (CAPABILITY_STATUSES as readonly string[]).includes(value);
}

/** Поля возможности, которые вообще лежат в карте. `declaredBy` и `pending` приложение добавляет само. */
export interface CapabilityItem {
  id: string;
  title?: string;
  parent?: string;
  summary?: string;
  status?: CapabilityStatus;
  note?: string;
}

export interface CapabilityLike {
  id: string;
  parent?: string;
  status?: string;
}

export interface Tally {
  implemented: number;
  partial: number;
  not_implemented: number;
  unassessed: number;
  total: number;
}

export interface CapabilitySummary {
  /** Нижняя возможность — без подпунктов. Состояние собственное только у неё. */
  leaf: boolean;
  /** У родителя — по нижним возможностям под ним (правило в `stateOfTally`). */
  state: CapabilityState;
  /** Нижние возможности под ним; у самой нижней — она одна. */
  tally: Tally;
}

export interface Summary {
  byId: Map<string, CapabilitySummary>;
  /** Все нижние возможности карты разом — для сводки над деревом и графом. */
  overall: Tally;
}

function emptyTally(): Tally {
  return { implemented: 0, partial: 0, not_implemented: 0, unassessed: 0, total: 0 };
}

/**
 * `status` у возможности с подпунктами не считается и не ошибка: возможность
 * могла быть нижней, когда её отметили, и стать родителем, когда к ней добавили
 * подпункт. Поэтому состояние читается только у нижних.
 */
function stateOfLeaf(status: string | undefined): CapabilityState {
  return isCapabilityStatus(status) ? status : 'unassessed';
}

/**
 * Цвет родителя берётся из счёта: все нижние реализованы — реализовано; все
 * нереализованы — не реализовано; ни одна не оценена — не оценено; всё прочее —
 * частично. Нижних нет вовсе (круг из `parent`) — не оценено: сказать нечего.
 */
export function stateOfTally(tally: Tally): CapabilityState {
  if (tally.total === 0 || tally.unassessed === tally.total) return 'unassessed';
  if (tally.implemented === tally.total) return 'implemented';
  if (tally.not_implemented === tally.total) return 'not_implemented';
  return 'partial';
}

/**
 * Одним проходом: для каждой возможности — нижняя ли она, её состояние и счёт
 * нижних под ней. `parent`, которого в списке нет, читается как «верхний
 * уровень», круг из `parent` — тоже (как и дерево на экране).
 */
export function summarize(
  capabilities: readonly CapabilityLike[],
  statusOf: (item: CapabilityLike) => string | undefined = (item) => item.status
): Summary {
  const known = new Set(capabilities.map((item) => item.id));
  const children = new Map<string, string[]>();
  for (const item of capabilities) {
    if (item.parent && item.parent !== item.id && known.has(item.parent)) {
      children.set(item.parent, [...(children.get(item.parent) ?? []), item.id]);
    }
  }
  const byItem = new Map(capabilities.map((item) => [item.id, item]));

  const leavesUnder = (id: string, seen: Set<string>): string[] => {
    if (seen.has(id)) return [];
    seen.add(id);
    const kids = children.get(id) ?? [];
    if (kids.length === 0) return [id];
    return kids.flatMap((kid) => leavesUnder(kid, seen));
  };

  const add = (tally: Tally, state: CapabilityState) => {
    tally[state] += 1;
    tally.total += 1;
  };

  const byId = new Map<string, CapabilitySummary>();
  const overall = emptyTally();

  for (const item of capabilities) {
    if (byId.has(item.id)) continue;
    const kids = children.get(item.id) ?? [];
    if (kids.length === 0) {
      const state = stateOfLeaf(statusOf(item));
      const tally = emptyTally();
      add(tally, state);
      add(overall, state);
      byId.set(item.id, { leaf: true, state, tally });
      continue;
    }
    const tally = emptyTally();
    for (const leaf of leavesUnder(item.id, new Set())) {
      const target = byItem.get(leaf);
      if (target) add(tally, stateOfLeaf(statusOf(target)));
    }
    byId.set(item.id, { leaf: false, state: stateOfTally(tally), tally });
  }

  return { byId, overall };
}

/** «5 из 8 реализовано, 2 не оценено» — счёт родителя словами; нулевые доли молчат. */
export function tallyText(tally: Tally): string {
  if (tally.total === 0) return 'нижних возможностей нет';
  const parts = [`${tally.implemented} из ${tally.total} реализовано`];
  if (tally.partial) parts.push(`${tally.partial} частично`);
  if (tally.not_implemented) parts.push(`${tally.not_implemented} не реализовано`);
  if (tally.unassessed) parts.push(`${tally.unassessed} не оценено`);
  return parts.join(', ');
}

/**
 * Возможности, видимые при фильтре по состоянию: нижние этого состояния и все
 * их предки — без родителей их не найти. `null` — фильтра нет, видно всё.
 */
export function visibleUnder(
  capabilities: readonly CapabilityLike[],
  summary: Summary,
  filter: CapabilityState | null
): Set<string> | null {
  if (filter === null) return null;
  const byItem = new Map(capabilities.map((item) => [item.id, item]));
  const visible = new Set<string>();
  for (const item of capabilities) {
    const own = summary.byId.get(item.id);
    if (!own?.leaf || own.state !== filter) continue;
    let at: CapabilityLike | undefined = item;
    while (at && !visible.has(at.id)) {
      visible.add(at.id);
      at = at.parent ? byItem.get(at.parent) : undefined;
    }
  }
  return visible;
}

/** Несохранённая правка отметки на экране: чего нет в патче — того человек не трогал. */
export interface MarkPatch {
  status?: CapabilityStatus | null;
  note?: string;
}

/** Отметка с экрана: `status: null` снимает отметку, `note` — необязательна. */
export interface Mark {
  id: string;
  status: CapabilityStatus | null;
  note?: string;
}

/** Копия возможности только с теми полями, что лежат в карте: `declaredBy` и `pending` схема не знает. */
export function cleanItem(source: CapabilityItem & Record<string, unknown>): CapabilityItem {
  const item: CapabilityItem = { id: source.id };
  if (source.title) item.title = source.title;
  if (source.parent) item.parent = source.parent;
  if (source.summary) item.summary = source.summary;
  if (isCapabilityStatus(source.status)) item.status = source.status;
  if (source.note) item.note = source.note;
  return item;
}

/**
 * Отметка — повторное объявление возможности, а оно заменяет элемент целиком
 * (`foldMaps`), поэтому в черновик едут все поля возможности вместе с новыми
 * `status` и `note`: иначе отметка стёрла бы описание (docs/07-maps.md,
 * «Состояние реализации»). Нет `note` в отметке — прежняя остаётся; пустая
 * строка — снимает. Неизвестные `id` возвращаются отдельно: пачка принимается
 * целиком или не принимается.
 */
export function applyMarks(
  current: readonly (CapabilityItem & Record<string, unknown>)[],
  marks: readonly Mark[]
): { items: CapabilityItem[]; unknown: string[] } {
  const byId = new Map(current.map((item) => [item.id, item]));
  // Дубль в пачке — не две отметки, а уточнение: побеждает последняя.
  const last = new Map(marks.map((mark) => [mark.id, mark]));

  const items: CapabilityItem[] = [];
  const unknown: string[] = [];
  for (const mark of last.values()) {
    const source = byId.get(mark.id);
    if (!source) {
      unknown.push(mark.id);
      continue;
    }
    const item = cleanItem(source);
    if (mark.status === null) delete item.status;
    else item.status = mark.status;
    if (mark.note !== undefined) {
      const note = mark.note.trim();
      if (note) item.note = note;
      else delete item.note;
    }
    items.push(item);
  }
  return { items, unknown };
}
