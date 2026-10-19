import { layerOf } from './layers';
import type { Evidence, EvidenceVerdict } from './maps';

/**
 * Группы кодовой карты — уровень над модулями (docs/07-maps.md, «Группы:
 * уровень над модулями»). Чистые функции над списками: их считает экран, а не
 * сервер, и считает одним правилом, чтобы обзор и вид группы не разошлись.
 *
 * Автоматические группы выводятся из путей и работают на любой карте.
 * Объявленные группы (`groups` в карте) добавляются поверх: членство в них
 * сильнее автоматического (docs/07-maps.md).
 */

/** Модули без пути, с `id` из одного слова. */
export const OTHER_GROUP = 'Прочее';
/** Файл лежит в корне проекта. */
export const ROOT_GROUP = '(корень)';

const PATH_LIKE = /\/[^/]+\.[A-Za-z0-9]+$/;

export interface GroupModule {
  id: string;
  title?: string | undefined;
  layer?: string | undefined;
  path?: string | undefined;
  summary?: string | undefined;
}

export interface GroupImport {
  from: string;
  to: string;
  evidence: Evidence;
  status?: EvidenceVerdict | undefined;
  declaredBy?: string | undefined;
  pending?: boolean | undefined;
}

/** Группа, объявленная картой (`groups` в `docdd-codemap`). */
export interface DeclaredGroup {
  id: string;
  title?: string | undefined;
  summary?: string | undefined;
  /** id группы-родителя: формат допускает вложенность, экран рисует один уровень. */
  parent?: string | undefined;
  /** Префиксы путей: в группу входят модули под ними (по границе сегмента). */
  paths?: readonly string[] | undefined;
  /** Модули, входящие в группу поимённо — сильнее `paths`. */
  modules?: readonly string[] | undefined;
  capability?: string | undefined;
  declaredBy?: string | undefined;
}

export interface Group {
  id: string;
  title: string;
  declaredBy?: string | undefined;
  /** Выведена из путей, а не объявлена картой. */
  auto: boolean;
  summary?: string | undefined;
  /** Возможность функциональной карты, которую группа реализует (у объявленной). */
  capability?: string | undefined;
  /** Модули группы — и объявленные картой, и упомянутые только в импортах: связь без конца не рисуют. */
  members: GroupModule[];
}

export interface GroupLink {
  from: string;
  to: string;
  imports: GroupImport[];
  /** По самому плохому из импортов; `pending` — только когда все такие. */
  status: EvidenceVerdict;
  /** Группы зависят друг от друга по кругу. */
  cycle: boolean;
}

export interface Grouping {
  groups: Group[];
  byId: ReadonlyMap<string, Group>;
  /** Группа модуля; модуля, которого карта не называла, — по тому же правилу. */
  groupOf: (moduleId: string) => string;
  /** Связи между группами: импорты, чьи концы лежат в разных группах, свёрнуты в одну. */
  links: GroupLink[];
}

/**
 * Автоматическая группа: первые два сегмента каталога файла; для dotted-имени
 * пакета — первые два сегмента без последнего; иначе `Прочее`.
 */
export function autoGroupOf(module: Pick<GroupModule, 'id' | 'path'>): string {
  const path = pathOf(module);
  if (path) {
    const directory = path.split('/').filter(Boolean).slice(0, -1);
    return directory.length === 0 ? ROOT_GROUP : directory.slice(0, 2).join('/');
  }
  if (!module.id.includes('/')) {
    const parts = module.id.split('.').filter(Boolean);
    if (parts.length >= 2) return parts.slice(0, -1).slice(0, 2).join('.');
  }
  return OTHER_GROUP;
}

const BAD: ReadonlySet<EvidenceVerdict> = new Set(['missing', 'stale', 'still_present']);

/** Расхождение не растворяется в сумме: плохо хоть одно — плохо вся связь. */
export function worstStatus(imports: readonly GroupImport[]): EvidenceVerdict {
  const bad = imports.find((item) => item.status && BAD.has(item.status));
  if (bad?.status) return bad.status;
  if (imports.length > 0 && imports.every((item) => item.status === 'pending')) return 'pending';
  return 'ok';
}

/** Путь под префиксом — по границе сегмента: `server/lib` не захватывает `server/library`. */
function under(path: string, prefix: string): boolean {
  const clean = prefix.replace(/\/+$/, '');
  return clean !== '' && (path === clean || path.startsWith(`${clean}/`));
}

function pathOf(module: Pick<GroupModule, 'id' | 'path'>): string | undefined {
  return module.path ?? (PATH_LIKE.test(module.id) ? module.id : undefined);
}

/**
 * Чьё правило сильнее: поимённый `modules` → самый длинный подходящий префикс
 * `paths` → ничьё (автоматическая группа). Два равных правила, называющих
 * разные группы, разрешаются в пользу объявленного позже — порядок
 * подтверждения карт (`foldMaps`), а не алфавит.
 */
export function declaredGroupOf(module: Pick<GroupModule, 'id' | 'path'>, declared: readonly DeclaredGroup[]): string | null {
  let named: string | null = null;
  for (const group of declared) {
    if (group.modules?.includes(module.id)) named = group.id;
  }
  if (named) return named;

  const path = pathOf(module);
  if (!path) return null;
  let best: string | null = null;
  let length = -1;
  for (const group of declared) {
    for (const prefix of group.paths ?? []) {
      const size = prefix.replace(/\/+$/, '').length;
      if (under(path, prefix) && size >= length) {
        best = group.id;
        length = size;
      }
    }
  }
  return best;
}

/**
 * Экран рисует один уровень: модули подгруппы относятся к самой верхней группе
 * цепочки. `parent` на несуществующую группу — группа считается верхней.
 */
function topOf(id: string, byId: ReadonlyMap<string, DeclaredGroup>): string {
  // Обрыв цикла и призрак-родитель — как у ancestors() (hierarchy.ts, ADR-0027);
  // при цикле верхней считается точка, где он замкнулся.
  const nodes = [...byId].map(([key, g]) => ({ id: key, parent: g.parent }));
  const last = ancestors(id, nodes).at(-1) ?? id;
  const next = byId.get(last)?.parent;
  return next && byId.has(next) ? next : last;
}




export function groupModules(
  modules: readonly GroupModule[],
  imports: readonly GroupImport[],
  declared: readonly DeclaredGroup[] = []
): Grouping {
  const declaredById = new Map(declared.map((group) => [group.id, group]));
  const known = new Map(modules.map((module) => [module.id, module]));
  // Конец импорта, которого карта не объявила, — тоже участник: иначе связь
  // повисла бы на группе, в которой нет ни одного модуля.
  const everyone: GroupModule[] = [...modules];
  for (const item of imports) {
    for (const id of [item.from, item.to]) {
      if (!known.has(id)) {
        const implicit: GroupModule = { id };
        known.set(id, implicit);
        everyone.push(implicit);
      }
    }
  }

  const groupIdOf = new Map<string, string>();
  const groups = new Map<string, Group>();
  for (const module of everyone) {
    const named = declaredGroupOf(module, declared);
    const key = named ? topOf(named, declaredById) : autoGroupOf(module);
    groupIdOf.set(module.id, key);
    // Пустая группа не рисуется: группа создаётся, только когда в неё что-то попало.
    const info = declaredById.get(key);
    const group = groups.get(key) ?? (info
      ? { id: key, title: info.title ?? key, auto: false, summary: info.summary, capability: info.capability, declaredBy: info.declaredBy, members: [] }
      : { id: key, title: key, auto: true, members: [] });
    group.members.push(module);
    groups.set(key, group);
  }

  const groupOf = (moduleId: string): string => groupIdOf.get(moduleId) ?? autoGroupOf({ id: moduleId });

  const collected = new Map<string, GroupLink>();
  for (const item of imports) {
    const from = groupOf(item.from);
    const to = groupOf(item.to);
    if (from === to) continue;
    const key = `${from}>${to}`;
    const link = collected.get(key) ?? { from, to, imports: [], status: 'ok' as EvidenceVerdict, cycle: false };
    link.imports.push(item);
    collected.set(key, link);
  }
  const links = [...collected.values()];
  for (const link of links) link.status = worstStatus(link.imports);

  // Цикл на уровне групп: на уровне модулей он распылён и не виден.
  const outgoing = new Map<string, string[]>();
  for (const link of links) outgoing.set(link.from, [...(outgoing.get(link.from) ?? []), link.to]);
  const reaches = (start: string, goal: string): boolean => {
    const seen = new Set<string>();
    const stack = [start];
    while (stack.length > 0) {
      const at = stack.pop() as string;
      if (at === goal) return true;
      if (seen.has(at)) continue;
      seen.add(at);
      stack.push(...(outgoing.get(at) ?? []));
    }
    return false;
  };
  for (const link of links) link.cycle = reaches(link.to, link.from);

  const sorted = [...groups.values()].sort((a, b) => a.title.localeCompare(b.title));
  return { groups: sorted, byId: new Map(sorted.map((group) => [group.id, group])), groupOf, links };
}

// --- карточка группы ---

export interface GroupCard {
  groupId: string;
  title: string;
  auto: boolean;
  summary?: string | undefined;
  capability?: string | undefined;
  declaredBy?: string | undefined;
  moduleCount: number;
  layers: { layer: string; count: number }[];
  /** Модули, на которые ссылаются снаружи, и сколько групп-импортёров у каждого. */
  surface: { id: string; title?: string | undefined; importers: number }[];
  dependsOn: { groupId: string; title: string; count: number }[];
  usedBy: { groupId: string; title: string; count: number }[];
}

export function groupCard(grouping: Grouping, groupId: string): GroupCard | null {
  const group = grouping.byId.get(groupId);
  if (!group) return null;

  const layers = new Map<string, number>();
  for (const member of group.members) {
    const layer = layerOf(member);
    layers.set(layer, (layers.get(layer) ?? 0) + 1);
  }

  const importers = new Map<string, Set<string>>();
  for (const link of grouping.links) {
    if (link.to !== groupId) continue;
    for (const item of link.imports) {
      importers.set(item.to, (importers.get(item.to) ?? new Set()).add(link.from));
    }
  }
  const titleOf = (id: string) => group.members.find((member) => member.id === id)?.title;
  const surface = [...importers].map(([id, from]) => ({ id, title: titleOf(id), importers: from.size }))
    .sort((a, b) => b.importers - a.importers || a.id.localeCompare(b.id));

  const named = (id: string) => grouping.byId.get(id)?.title ?? id;
  return {
    groupId,
    title: group.title,
    auto: group.auto,
    summary: group.summary,
    capability: group.capability,
    declaredBy: group.declaredBy,
    moduleCount: group.members.length,
    layers: [...layers].map(([layer, count]) => ({ layer, count })).sort((a, b) => b.count - a.count || a.layer.localeCompare(b.layer)),
    surface,
    dependsOn: grouping.links.filter((link) => link.from === groupId)
      .map((link) => ({ groupId: link.to, title: named(link.to), count: link.imports.length })),
    usedBy: grouping.links.filter((link) => link.to === groupId)
      .map((link) => ({ groupId: link.from, title: named(link.from), count: link.imports.length }))
  };
}

// --- вид группы ---

/** Что показать в группе: её модули и импорты между ними. */
export function groupScope(
  grouping: Grouping,
  groupId: string,
  imports: readonly GroupImport[]
): { modules: GroupModule[]; imports: GroupImport[] } {
  const group = grouping.byId.get(groupId);
  if (!group) return { modules: [], imports: [] };
  return {
    modules: group.members,
    imports: imports.filter((item) => grouping.groupOf(item.from) === groupId && grouping.groupOf(item.to) === groupId)
  };
}

/** Порты группы: модули, у которых есть связи за её пределами. */
export function portsOf(grouping: Grouping, groupId: string, imports: readonly GroupImport[]): Set<string> {
  const ports = new Set<string>();
  for (const item of imports) {
    const from = grouping.groupOf(item.from);
    const to = grouping.groupOf(item.to);
    if (from === to) continue;
    if (from === groupId) ports.add(item.from);
    if (to === groupId) ports.add(item.to);
  }
  return ports;
}

export interface GhostNode {
  /** id модуля или, у свёрнутого, `group:<id группы>`. */
  id: string;
  title?: string | undefined;
  groupId: string;
  groupTitle: string;
  /** Свёрнутая группа соседей: сколько модулей за ней. */
  collapsed?: number;
}

/** Больше стольких внешних соседей — сворачиваем в узлы-группы, иначе выбор вернул бы стену линий. */
export const GHOST_LIMIT = 12;

/**
 * Соседи выбранного модуля из других групп — «призраки». Показывают, куда
 * уходят его связи, и не претендуют на то, чтобы быть частью открытой группы.
 */
export function ghostNeighbors(
  grouping: Grouping,
  groupId: string,
  moduleId: string,
  modules: readonly GroupModule[],
  imports: readonly GroupImport[]
): { ghosts: GhostNode[]; imports: GroupImport[] } {
  const byId = new Map(modules.map((module) => [module.id, module]));
  const touching = imports.filter((item) => (item.from === moduleId) !== (item.to === moduleId))
    .filter((item) => grouping.groupOf(item.from === moduleId ? item.to : item.from) !== groupId);
  const otherEnd = (item: GroupImport) => (item.from === moduleId ? item.to : item.from);
  const distinct = [...new Set(touching.map(otherEnd))];
  const titleOfGroup = (id: string) => grouping.byId.get(id)?.title ?? id;

  if (distinct.length <= GHOST_LIMIT) {
    return {
      ghosts: distinct.map((id) => {
        const groupOfIt = grouping.groupOf(id);
        return { id, title: byId.get(id)?.title, groupId: groupOfIt, groupTitle: titleOfGroup(groupOfIt) };
      }),
      imports: touching
    };
  }

  const counts = new Map<string, Set<string>>();
  for (const id of distinct) {
    const key = grouping.groupOf(id);
    counts.set(key, (counts.get(key) ?? new Set()).add(id));
  }
  const ghostId = (key: string) => `group:${key}`;
  return {
    ghosts: [...counts].map(([key, ids]) => ({
      id: ghostId(key), title: titleOfGroup(key), groupId: key, groupTitle: titleOfGroup(key), collapsed: ids.size
    })),
    imports: touching.map((item) => {
      const key = grouping.groupOf(otherEnd(item));
      return item.from === moduleId ? { ...item, to: ghostId(key) } : { ...item, from: ghostId(key) };
    })
  };
}

// --- дерево групп на всю глубину (ADR-0027, T-0092) ---
// Новое лежит в конце файла: карта M-0001 хранит номера строк-свидетельств, а
// старые функции выше остаются как были — они по-прежнему сжимают группу до
// верхней (один уровень), и экран, который их зовёт, не меняется.
// Импорт в конце допустим: объявления поднимаются, порядок не важен.
// (Плагина import/first в линтере нет, поэтому правило не отключается.)
import { ancestors, foldEdges, visibleAt, type Edge, type FoldedEdge, type FoldResult, type TreeNode } from './hierarchy';

export interface GroupTreeNode extends TreeNode {
  title: string;
  auto: boolean;
  declaredBy?: string | undefined;
  summary?: string | undefined;
  capability?: string | undefined;
  /** Модули, у которых это самая глубокая подходящая группа (без потомков). */
  members: GroupModule[];
}

export interface GroupTree {
  nodes: GroupTreeNode[];
  /** Самая глубокая группа модуля; модуля, которого карта не называла, — по автоматическому правилу. */
  groupOf: (moduleId: string) => string;
}

/** Цепочка id автоматических групп от корня к самой глубокой: id — путь каталога. */
function autoChain(module: Pick<GroupModule, 'id' | 'path'>): string[] {
  const path = pathOf(module);
  if (path) {
    const dirs = path.split('/').filter(Boolean).slice(0, -1);
    return dirs.length === 0 ? [ROOT_GROUP] : dirs.map((_, i) => dirs.slice(0, i + 1).join('/'));
  }
  if (!module.id.includes('/')) {
    const parts = module.id.split('.').filter(Boolean).slice(0, -1);
    if (parts.length >= 1 && module.id.split('.').filter(Boolean).length >= 2) {
      return parts.map((_, i) => parts.slice(0, i + 1).join('.'));
    }
  }
  return [OTHER_GROUP];
}

/**
 * Дерево групп по всему дереву каталогов плюс объявленные группы с их `parent`.
 * Автоматическая группа без собственных модулей и с одним ребёнком схлопывается
 * в него: цепочка `a → a/b → a/b/c` без файлов на промежуточных уровнях не
 * даёт лишних щелчков при раскрытии.
 */
export function groupTree(
  modules: readonly GroupModule[],
  imports: readonly GroupImport[],
  declared: readonly DeclaredGroup[] = []
): GroupTree {
  const declaredById = new Map(declared.map((group) => [group.id, group]));
  const everyone: GroupModule[] = [...modules];
  const known = new Set(modules.map((module) => module.id));
  for (const item of imports) {
    for (const id of [item.from, item.to]) {
      if (!known.has(id)) {
        known.add(id);
        everyone.push({ id });
      }
    }
  }

  const nodes = new Map<string, GroupTreeNode>();
  const placed = new Map<string, string>();
  const ensureAuto = (id: string, parent: string | undefined): void => {
    if (!nodes.has(id)) nodes.set(id, { id, parent, title: id, auto: true, members: [] });
  };
  const ensureDeclared = (start: string): void => {
    const seen = new Set<string>();
    let at: string | undefined = start;
    while (at !== undefined && !seen.has(at) && declaredById.has(at)) {
      seen.add(at);
      const info = declaredById.get(at) as DeclaredGroup;
      const parent: string | undefined = info.parent && info.parent !== at && declaredById.has(info.parent) ? info.parent : undefined;
      if (!nodes.has(at)) {
        nodes.set(at, {
          id: at, parent, title: info.title ?? at, auto: false, summary: info.summary,
          capability: info.capability, declaredBy: info.declaredBy, members: []
        });
      }
      at = parent;
    }
  };

  for (const module of everyone) {
    const named = declaredGroupOf(module, declared);
    let key: string;
    if (named) {
      ensureDeclared(named);
      key = named;
    } else {
      const chain = autoChain(module);
      chain.forEach((id, i) => ensureAuto(id, i > 0 ? chain[i - 1] : undefined));
      key = chain[chain.length - 1] as string;
    }
    nodes.get(key)?.members.push(module);
    placed.set(module.id, key);
  }

  // Схлопывание цепочек из одного ребёнка (только автоматические и пустые).
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of [...nodes.values()]) {
      if (!node.auto || node.members.length > 0) continue;
      const children = [...nodes.values()].filter((other) => other.parent === node.id);
      if (children.length !== 1) continue;
      (children[0] as GroupTreeNode).parent = node.parent;
      nodes.delete(node.id);
      changed = true;
    }
  }

  return {
    nodes: [...nodes.values()],
    groupOf: (moduleId) => placed.get(moduleId) ?? autoGroupOf({ id: moduleId })
  };
}

export interface FoldedGroupImports extends FoldResult {
  /** Исходные импорты свёрнутой стрелки — чтобы развернуть её до модулей. */
  importsOf: (edge: FoldedEdge) => GroupImport[];
}

/**
 * Импорты, свёрнутые до видимого уровня дерева групп. `worst` — по рангу
 * вердиктов `worstStatus` (тот же, что у свёртки уровня 1). `level` 0 — верхние
 * группы; `openId` — группа, раскрытая на месте (см. `visibleAt`).
 */
export function foldGroupImports(
  tree: GroupTree,
  imports: readonly GroupImport[],
  options: { openId?: string | null; level?: number } = {}
): FoldedGroupImports {
  const origin = new Map<Edge, GroupImport>();
  const edges: Edge[] = imports.map((item) => {
    const edge: Edge = { from: item.from, to: item.to, ...(item.status ? { verdict: item.status } : {}) };
    origin.set(edge, item);
    return edge;
  });
  const visible = (id: string): string => visibleAt(tree.groupOf(id), tree.nodes, options.openId ?? null, options.level ?? 0);
  // worstStatus ждёт импорты целиком; от них ему нужен только статус.
  const worstOf = (verdicts: string[]): string =>
    worstStatus(verdicts.map((status) => ({ status: status as EvidenceVerdict }) as GroupImport));
  const folded = foldEdges(edges, visible, worstOf);
  return {
    ...folded,
    importsOf: (edge) => edge.members.flatMap((member) => origin.get(member) ?? [])
  };
}
