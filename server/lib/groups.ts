import type { EvidenceVerdict } from './maps';

/**
 * Группы кодовой карты: уровень над модулями (docs/07-maps.md, «Группы:
 * уровень над модулями»). Чистые функции над списками модулей, импортов и
 * объявленных групп — те же данные, тот же ответ. Группы как картина нигде не
 * хранятся: объявленные приходят из карт, автоматические считаются здесь,
 * связи между ними сворачиваются из импортов, порты и поверхность выводятся из
 * тех же связей.
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

/** Группа, как её объявляет карта (`docdd-codemap`, `groups`). */
export interface DeclaredGroup {
  id: string;
  title?: string;
  summary?: string;
  parent?: string;
  paths?: readonly string[];
  modules?: readonly string[];
  capability?: string;
  links?: readonly { to: string; summary?: string }[];
}

/** Откуда модуль попал в группу: названа поимённо, поймана префиксом или посчитана по пути. */
export type MemberSource = 'named' | 'prefix' | 'auto';

export interface Group {
  id: string;
  title: string;
  summary?: string;
  /** Автогруппа: посчитана по пути, а не объявлена в карте. */
  auto: boolean;
  /** Возможность функциональной карты, которую группа реализует. */
  capability?: string;
  /** `id` модулей группы вместе с модулями вложенных в неё групп. */
  modules: string[];
  /** Вложенные группы: формат допускает вложенность, а на экране пока один уровень. */
  children: string[];
  /** Из чего состав: сколько модулей названо поимённо, поймано префиксом и посчитано по пути. */
  sources: Record<MemberSource, number>;
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
  /** Понятная подпись из `links` объявленной группы; нет — у стрелки остаётся число. */
  summary?: string;
}

export interface GroupModel<I extends GroupImport = GroupImport> {
  /** Группы верхнего уровня — узлы обзора. Крупные первыми, «Прочее» последней. */
  groups: Group[];
  /** Модуль → группа верхнего уровня. */
  groupOf: Map<string, string>;
  /** Модуль → откуда он попал в группу. */
  memberSource: Map<string, MemberSource>;
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

/** Путь, по которому модуль сравнивается с префиксами `paths`. */
function pathOf(module: GroupModule): string {
  return module.path ?? module.id;
}

/**
 * Сводит модули, импорты и объявленные группы в модель. Модуль, упомянутый
 * только в импорте, тоже получает группу: на диаграмме он нарисован, и без
 * группы стрелка к нему потерялась бы.
 *
 * Кто в какой группе — по убыванию силы: поимённо (`modules` группы; назван в
 * двух — побеждает объявленная последней), по самому длинному префиксу из
 * `paths` (равные — тоже побеждает последняя), по пути. Объявленные и
 * автоматические группы работают вместе: что объявленные не взяли, остаётся в
 * автогруппах. Группа без единого модуля не показывается.
 */
export function buildGroups<I extends GroupImport>(
  modules: readonly GroupModule[],
  imports: readonly I[],
  declared: readonly DeclaredGroup[] = []
): GroupModel<I> {
  const known = new Map<string, GroupModule>(modules.map((module) => [module.id, module]));
  for (const edge of imports) {
    for (const id of [edge.from, edge.to]) {
      if (!known.has(id)) known.set(id, { id });
    }
  }

  const declaredById = new Map(declared.map((group) => [group.id, group]));

  // 1. Поимённо: позже объявленная побеждает.
  const named = new Map<string, string>();
  for (const group of declared) {
    for (const id of group.modules ?? []) named.set(id, group.id);
  }

  // 2. По префиксу: самый длинный; при равенстве — позже объявленная.
  const prefixed = (module: GroupModule): string | null => {
    const path = pathOf(module);
    let best: { group: string; length: number } | null = null;
    for (const group of declared) {
      for (const prefix of group.paths ?? []) {
        if (path.startsWith(prefix) && (best === null || prefix.length >= best.length)) {
          best = { group: group.id, length: prefix.length };
        }
      }
    }
    return best?.group ?? null;
  };

  const narrow = new Map<string, string>();
  const memberSource = new Map<string, MemberSource>();
  for (const module of known.values()) {
    const byName = named.get(module.id);
    if (byName !== undefined) {
      narrow.set(module.id, byName);
      memberSource.set(module.id, 'named');
      continue;
    }
    const byPrefix = prefixed(module);
    if (byPrefix !== null) {
      narrow.set(module.id, byPrefix);
      memberSource.set(module.id, 'prefix');
      continue;
    }
    // 3. По пути. Автогруппа с тем же id, что у объявленной, — та же группа.
    narrow.set(module.id, autoGroupId(module));
    memberSource.set(module.id, 'auto');
  }

  // Родитель, которого в карте нет, и круг из `parent` читаются как «верхний
  // уровень», как неизвестный `parent` у возможности.
  const topOf = (id: string): string => {
    const seen = new Set<string>([id]);
    let at = id;
    for (;;) {
      const parent = declaredById.get(at)?.parent;
      if (!parent || parent === at || !declaredById.has(parent)) return at;
      if (seen.has(parent)) return id;
      seen.add(parent);
      at = parent;
    }
  };

  const groupOf = new Map<string, string>();
  const members = new Map<string, string[]>();
  for (const module of known.values()) {
    const top = topOf(narrow.get(module.id) as string);
    groupOf.set(module.id, top);
    members.set(top, [...(members.get(top) ?? []), module.id]);
  }

  const groups: Group[] = [...members].map(([id, ids]) => {
    const own = declaredById.get(id);
    const sources: Record<MemberSource, number> = { named: 0, prefix: 0, auto: 0 };
    for (const module of ids) sources[memberSource.get(module) as MemberSource] += 1;
    return {
      id,
      title: own?.title ?? id,
      summary: own?.summary,
      auto: own === undefined,
      capability: own?.capability,
      modules: ids,
      children: declared.filter((group) => group.id !== id && topOf(group.id) === id).map((group) => group.id),
      sources
    };
  })
    // «Прочее» — свалка для того, что не отнесли по пути, и в конце списка; остальные — крупные
    // первыми, при равенстве по коду символов: порядок не зависит ни от обхода, ни от локали.
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

  // Подпись связи объявляет группа-источник (или любая вложенная в неё) в `links`.
  const summaryOf = (from: string, to: string): string | undefined => {
    for (const group of declared) {
      if (topOf(group.id) !== from) continue;
      for (const link of group.links ?? []) {
        if (link.summary && topOf(link.to) === to) return link.summary;
      }
    }
    return undefined;
  };

  const links: GroupLink<I>[] = [...folded.values()].map(({ from, to, imports: list }) => ({
    from,
    to,
    count: list.length,
    imports: list,
    status: worstVerdict(list.map((item) => item.status)),
    // Стрелка лежит на круге, если из её конца можно вернуться в начало.
    cycle: reaches(to, from),
    summary: summaryOf(from, to)
  })).sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));

  const surface = new Map<string, string[]>();
  for (const [id, entry] of ports) {
    if (entry.in === 0) continue;
    const group = groupOf.get(id);
    if (group) surface.set(group, [...(surface.get(group) ?? []), id]);
  }

  return { groups, groupOf, memberSource, links, ports, surface };
}

/** Модули группы. */
export function membersOf(model: GroupModel, groupId: string): string[] {
  return model.groups.find((group) => group.id === groupId)?.modules ?? [];
}

/** Модули, которые ещё не попали ни в одну объявленную группу, — то, что просят у модели («Сгруппировать модули»). */
export function ungroupedModules(model: GroupModel): string[] {
  return [...model.memberSource].filter(([, source]) => source === 'auto').map(([id]) => id);
}
