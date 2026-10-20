/**
 * Общий вид «было → станет» для порядка (R-0072): предпросмотры порядка по
 * важности и разбиения на фазы. Чистая функция — места считает сервер/библиотека,
 * а не экран, чтобы три предпросмотра не разошлись в счёте.
 */

export interface OrderGroup {
  id: string;
  items: string[];
}

export interface OrderRow {
  id: string;
  /** Место внутри группы, с 1; `null` — задачи там раньше не было. */
  from: number | null;
  to: number;
  /** Группа, откуда пришла задача; `undefined` — не переезжала. */
  fromGroup?: string | null | undefined;
  moved: boolean;
}

export interface OrderGroupDiff {
  id: string;
  fromPlace: number | null;
  toPlace: number;
  moved: boolean;
  rows: OrderRow[];
  /** Были, но ушли из группы. */
  left: string[];
}

export interface OrderDiffResult {
  groups: OrderGroupDiff[];
  /** Сколько фаз и задач сменили место или группу. */
  movedGroups: number;
  movedItems: number;
}

/** Группа, которой «было» не знает (новая фаза или пул без фазы), получает `fromPlace: null`. */
export function orderDiff(before: readonly OrderGroup[], after: readonly OrderGroup[]): OrderDiffResult {
  const groupAt = new Map(before.map((group, at) => [group.id, at + 1]));
  const home = new Map<string, { group: string; place: number }>();
  for (const group of before) group.items.forEach((id, at) => home.set(id, { group: group.id, place: at + 1 }));

  let movedItems = 0;
  let movedGroups = 0;
  const groups = after.map((group, at): OrderGroupDiff => {
    const fromPlace = groupAt.get(group.id) ?? null;
    const rows = group.items.map((id, index): OrderRow => {
      const was = home.get(id);
      const sameGroup = was?.group === group.id;
      const moved = !was || !sameGroup || was.place !== index + 1;
      if (moved) movedItems += 1;
      return { id, from: sameGroup ? was.place : null, to: index + 1, ...(was && !sameGroup ? { fromGroup: was.group } : {}), moved };
    });
    const now = new Set(group.items);
    const left = (before.find((item) => item.id === group.id)?.items ?? []).filter((id) => !now.has(id));
    const moved = fromPlace !== at + 1;
    if (moved) movedGroups += 1;
    return { id: group.id, fromPlace, toPlace: at + 1, moved, rows, left };
  });
  return { groups, movedGroups, movedItems };
}
