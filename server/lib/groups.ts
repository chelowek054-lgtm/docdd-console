import type { EvidenceVerdict } from './maps';

/**
 * Группы кодовой карты: уровень над модулями (docs/07-maps.md, «Группы:
 * уровень над модулями»). Чистые функции над списками модулей и импортов — те
 * же данные, тот же ответ. Группы нигде не хранятся: автоматические считаются
 * здесь, связи между ними сворачиваются из импортов, порты и поверхность
 * выводятся из тех же связей.
 */

/** Модуль без группы и всё, что не удалось отнести по пути. */
export const OTHER_GROUP = 'Прочее';

export interface GroupModule {
  id: string;
  path?: string;
}

export interface GroupImport {
  from: string;
  to: string;
  status?: EvidenceVerdict;
}

export interface Group {
  id: string;
  title: string;
  /** Автогруппа: посчитана по пути, а не объявлена в карте. */
  auto: boolean;
  /** `id` модулей группы. */
  modules: string[];
}

export interface GroupLink<I extends GroupImport = GroupImport> {
  from: string;
  to: string;
  /** Сколько импортов свёрнуто в стрелку. */
  count: number;
  /** Исходные импорты — раскрытие стрелки показывает их со свидетельствами. */
  imports: I[];
  /** Худший из свёрнутых вердиктов (`worstVerdict`). */
  status: EvidenceVerdict;
  /** Стрелка лежит на круге между группами. */
  cycle: boolean;
}

export interface GroupModel<I extends GroupImport = GroupImport> {
  /** Крупные первыми, «Прочее» последней; при равенстве — по `id`. */
  groups: Group[];
  groupOf: Map<string, string>;
  links: GroupLink<I>[];
  /** Порт — модуль с импортом через границу своей группы. `out` — он импортирует, `in` — его импортируют. */
  ports: Map<string, { out: number; in: number }>;
  /** Публичная поверхность: у каждой группы — порты, которые импортируют снаружи. */
  surface: Map<string, string[]>;
}

const LOOKS_LIKE_PATH = /\//;

/**
 * Автогруппа модуля: путь модуля — его `path`; нет `path`, а `id` похож на путь
 * (есть `/`) — `id`; иначе — `id` как есть (dotted-имя пакета). Последний
 * сегмент (имя файла или модуля) отбрасывается, из остатка берутся первые два.
 * Ничего не осталось — `Прочее`.
 */
export function autoGroupId(module: GroupModule): string {
  const source = module.path ?? module.id;
  const dotted = module.path === undefined && !LOOKS_LIKE_PATH.test(module.id);
  const separator = dotted ? '.' : '/';
  const directory = source.split(separator).filter(Boolean).slice(0, -1).slice(0, 2);
  return directory.length > 0 ? directory.join(separator) : OTHER_GROUP;
}

/** Порядок вердиктов от худшего: сказанное о стрелке — самое плохое из свёрнутого. */
const WORST_FIRST: readonly EvidenceVerdict[] = ['missing', 'stale', 'still_present', 'pending'];

/**
 * `ok` — только когда все `ok`; не сошёлся хоть один — стрелка тоже; иначе,
 * если есть `pending`, — `pending`. Импорт без вердикта — ещё не сверен, но
 * ничего плохого о нём не сказано, поэтому считается как `ok`.
 */
export function worstVerdict(statuses: readonly (EvidenceVerdict | undefined)[]): EvidenceVerdict {
  for (const verdict of WORST_FIRST) {
    if (statuses.includes(verdict)) return verdict;
  }
  return 'ok';
}

/**
 * Сводит модули и импорты в модель групп. Модуль, упомянутый только в импорте,
 * тоже получает группу: на диаграмме он нарисован, и без группы стрелка к нему
 * потерялась бы.
 */
export function buildGroups<I extends GroupImport>(
  modules: readonly GroupModule[],
  imports: readonly I[]
): GroupModel<I> {
  const known = new Map<string, GroupModule>(modules.map((module) => [module.id, module]));
  for (const edge of imports) {
    for (const id of [edge.from, edge.to]) {
      if (!known.has(id)) known.set(id, { id });
    }
  }

  const groupOf = new Map<string, string>();
  const members = new Map<string, string[]>();
  for (const module of known.values()) {
    const group = autoGroupId(module);
    groupOf.set(module.id, group);
    members.set(group, [...(members.get(group) ?? []), module.id]);
  }

  // «Прочее» — свалка для того, что не отнесли по пути, и в конце списка; остальные — крупные
  // первыми, при равенстве по коду символов: порядок не зависит ни от обхода, ни от локали.
  const groups: Group[] = [...members].map(([id, ids]) => ({ id, title: id, auto: true, modules: ids }))
    .sort((a, b) => Number(a.id === OTHER_GROUP) - Number(b.id === OTHER_GROUP)
      || b.modules.length - a.modules.length
      || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const ports = new Map<string, { out: number; in: number }>();
  const port = (id: string) => {
    let entry = ports.get(id);
    if (!entry) {
      entry = { out: 0, in: 0 };
      ports.set(id, entry);
    }
    return entry;
  };

  const folded = new Map<string, { from: string; to: string; imports: I[] }>();
  for (const edge of imports) {
    const from = groupOf.get(edge.from);
    const to = groupOf.get(edge.to);
    // Импорт внутри группы стрелкой между группами не становится.
    if (!from || !to || from === to) continue;
    port(edge.from).out += 1;
    port(edge.to).in += 1;
    const key = `${from}>${to}`;
    const entry = folded.get(key) ?? { from, to, imports: [] };
    entry.imports.push(edge);
    folded.set(key, entry);
  }

  const next = new Map<string, string[]>();
  for (const { from, to } of folded.values()) next.set(from, [...(next.get(from) ?? []), to]);
  const reaches = (start: string, goal: string): boolean => {
    const seen = new Set<string>();
    const stack = [start];
    while (stack.length > 0) {
      const at = stack.pop() as string;
      if (at === goal) return true;
      if (seen.has(at)) continue;
      seen.add(at);
      stack.push(...(next.get(at) ?? []));
    }
    return false;
  };

  const links: GroupLink<I>[] = [...folded.values()].map(({ from, to, imports: list }) => ({
    from,
    to,
    count: list.length,
    imports: list,
    status: worstVerdict(list.map((item) => item.status)),
    // Стрелка лежит на круге, если из её конца можно вернуться в начало.
    cycle: reaches(to, from)
  })).sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));

  const surface = new Map<string, string[]>();
  for (const [id, entry] of ports) {
    if (entry.in === 0) continue;
    const group = groupOf.get(id);
    if (group) surface.set(group, [...(surface.get(group) ?? []), id]);
  }

  return { groups, groupOf, links, ports, surface };
}

/** Модули группы. */
export function membersOf(model: GroupModel, groupId: string): string[] {
  return model.groups.find((group) => group.id === groupId)?.modules ?? [];
}
