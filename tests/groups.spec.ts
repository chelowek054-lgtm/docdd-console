import { describe, expect, it } from 'vitest';

import {
  GHOST_LIMIT,
  OTHER_GROUP,
  ROOT_GROUP,
  autoGroupOf,
  ghostNeighbors,
  groupCard,
  groupModules,
  groupScope,
  portsOf,
  worstStatus,
  type GroupImport
} from '../server/lib/groups';

/**
 * Автоматические группы кодовой карты (docs/07-maps.md, «Группы: уровень над
 * модулями»).
 */

const evidence = { path: 'x.ts', line: 1, fragment: 'x' };
const edge = (from: string, to: string, status?: GroupImport['status']): GroupImport => ({ from, to, evidence, status });

describe('autoGroupOf', () => {
  it('первые два сегмента каталога файла', () => {
    expect(autoGroupOf({ id: 'a', path: 'server/lib/maps.ts' })).toBe('server/lib');
    expect(autoGroupOf({ id: 'a', path: 'app/pages/projects/[id]/maps.vue' })).toBe('app/pages');
  });

  it('файл в корне и каталог из одного сегмента', () => {
    expect(autoGroupOf({ id: 'a', path: 'nuxt.config.ts' })).toBe(ROOT_GROUP);
    expect(autoGroupOf({ id: 'a', path: 'server/index.ts' })).toBe('server');
  });

  it('id — путь: берётся он, когда path не задан', () => {
    expect(autoGroupOf({ id: 'cli/check.ts' })).toBe('cli');
    expect(autoGroupOf({ id: 'server/lib/maps.ts' })).toBe('server/lib');
  });

  it('dotted-имя пакета: два сегмента без последнего', () => {
    expect(autoGroupOf({ id: 'gastrograf.catalog.usda' })).toBe('gastrograf.catalog');
    expect(autoGroupOf({ id: 'gastrograf.catalog.usda.parse' })).toBe('gastrograf.catalog');
    expect(autoGroupOf({ id: 'gastrograf.core' })).toBe('gastrograf');
  });

  it('ничего подходящего — Прочее', () => {
    expect(autoGroupOf({ id: 'pandas' })).toBe(OTHER_GROUP);
  });
});

describe('groupModules', () => {
  const modules = [
    { id: 'server/lib/a.ts', layer: 'ядро', title: 'А' },
    { id: 'server/lib/b.ts', layer: 'ядро' },
    { id: 'app/pages/x.vue', layer: 'экраны' },
    { id: 'app/components/y.vue', layer: 'экраны' }
  ];

  it('собирает группы по каталогам и сортирует по названию', () => {
    const { groups } = groupModules(modules, []);
    expect(groups.map((group) => [group.id, group.members.length])).toEqual([
      ['app/components', 1], ['app/pages', 1], ['server/lib', 2]
    ]);
    expect(groups.every((group) => group.auto)).toBe(true);
  });

  it('импорты внутри группы связью не становятся; между группами — сворачиваются в одну', () => {
    const grouping = groupModules(modules, [
      edge('server/lib/a.ts', 'server/lib/b.ts'),
      edge('app/pages/x.vue', 'server/lib/a.ts'),
      edge('app/pages/x.vue', 'server/lib/b.ts')
    ]);
    expect(grouping.links).toHaveLength(1);
    expect(grouping.links[0]).toMatchObject({ from: 'app/pages', to: 'server/lib', cycle: false });
    expect(grouping.links[0]?.imports).toHaveLength(2);
  });

  it('конец импорта, которого карта не объявляла, — участник группы', () => {
    const grouping = groupModules(modules, [edge('app/pages/x.vue', 'server/lib/gone.ts')]);
    expect(grouping.byId.get('server/lib')?.members.map((member) => member.id)).toContain('server/lib/gone.ts');
    expect(grouping.groupOf('server/lib/gone.ts')).toBe('server/lib');
  });

  it('цикл на уровне групп подсвечен с обеих сторон', () => {
    const grouping = groupModules(modules, [
      edge('app/pages/x.vue', 'server/lib/a.ts'),
      edge('server/lib/b.ts', 'app/pages/x.vue'),
      edge('app/components/y.vue', 'app/pages/x.vue')
    ]);
    const byPair = Object.fromEntries(grouping.links.map((link) => [`${link.from}>${link.to}`, link.cycle]));
    expect(byPair).toEqual({
      'app/pages>server/lib': true,
      'server/lib>app/pages': true,
      'app/components>app/pages': false
    });
  });

  it('расхождение не растворяется в сумме', () => {
    expect(worstStatus([edge('a', 'b', 'ok'), edge('a', 'c', 'stale')])).toBe('stale');
    expect(worstStatus([edge('a', 'b', 'pending'), edge('a', 'c', 'pending')])).toBe('pending');
    expect(worstStatus([edge('a', 'b', 'pending'), edge('a', 'c', 'ok')])).toBe('ok');
    expect(worstStatus([])).toBe('ok');
  });
});

describe('карточка, вид группы, порты', () => {
  const modules = [
    { id: 'server/lib/a.ts', layer: 'ядро', title: 'А' },
    { id: 'server/lib/b.ts', layer: 'ядро' },
    { id: 'server/lib/c.ts', layer: 'утилиты' },
    { id: 'app/pages/x.vue', layer: 'экраны' },
    { id: 'cli/check.ts', layer: 'cli' }
  ];
  const imports = [
    edge('server/lib/a.ts', 'server/lib/b.ts'),
    edge('app/pages/x.vue', 'server/lib/a.ts'),
    edge('cli/check.ts', 'server/lib/a.ts'),
    edge('server/lib/b.ts', 'cli/check.ts')
  ];
  const grouping = groupModules(modules, imports);

  it('карточка: слои, публичная поверхность и зависимости с числом импортов', () => {
    const card = groupCard(grouping, 'server/lib');
    expect(card?.moduleCount).toBe(3);
    expect(card?.layers).toEqual([{ layer: 'ядро', count: 2 }, { layer: 'утилиты', count: 1 }]);
    expect(card?.surface).toEqual([{ id: 'server/lib/a.ts', title: 'А', importers: 2 }]);
    expect(card?.dependsOn).toEqual([{ groupId: 'cli', title: 'cli', count: 1 }]);
    expect(card?.usedBy.map((link) => link.groupId).sort()).toEqual(['app/pages', 'cli']);
  });

  it('нет такой группы — null', () => {
    expect(groupCard(grouping, 'нет')).toBeNull();
  });

  it('вид группы: её модули и импорты только между ними', () => {
    const scope = groupScope(grouping, 'server/lib', imports);
    expect(scope.modules.map((module) => module.id)).toEqual(['server/lib/a.ts', 'server/lib/b.ts', 'server/lib/c.ts']);
    expect(scope.imports).toEqual([imports[0]]);
  });

  it('порты — модули со связями за пределами группы', () => {
    expect([...portsOf(grouping, 'server/lib', imports)].sort()).toEqual(['server/lib/a.ts', 'server/lib/b.ts']);
  });
});

describe('ghostNeighbors — соседи выбранного модуля из других групп', () => {
  it('внешние соседи — призраки со связями к модулю, в обе стороны', () => {
    const modules = [{ id: 'server/lib/a.ts' }, { id: 'app/pages/x.vue', title: 'Экран' }, { id: 'cli/check.ts' }];
    const imports = [edge('app/pages/x.vue', 'server/lib/a.ts'), edge('server/lib/a.ts', 'cli/check.ts')];
    const grouping = groupModules(modules, imports);
    const { ghosts, imports: shown } = ghostNeighbors(grouping, 'server/lib', 'server/lib/a.ts', modules, imports);
    expect(ghosts).toEqual([
      { id: 'app/pages/x.vue', title: 'Экран', groupId: 'app/pages', groupTitle: 'app/pages' },
      { id: 'cli/check.ts', title: undefined, groupId: 'cli', groupTitle: 'cli' }
    ]);
    expect(shown).toHaveLength(2);
  });

  it('соседи из своей группы призраками не бывают', () => {
    const modules = [{ id: 'server/lib/a.ts' }, { id: 'server/lib/b.ts' }];
    const imports = [edge('server/lib/a.ts', 'server/lib/b.ts')];
    const grouping = groupModules(modules, imports);
    expect(ghostNeighbors(grouping, 'server/lib', 'server/lib/a.ts', modules, imports).ghosts).toEqual([]);
  });

  it('больше порога — сворачиваются в узлы-группы с числом модулей', () => {
    const outside = Array.from({ length: GHOST_LIMIT + 3 }, (_, index) => ({ id: `ext${index % 2}/dir/m${index}.ts` }));
    const modules = [{ id: 'server/lib/a.ts' }, ...outside];
    const imports = outside.map((module) => edge('server/lib/a.ts', module.id));
    const grouping = groupModules(modules, imports);
    const { ghosts, imports: shown } = ghostNeighbors(grouping, 'server/lib', 'server/lib/a.ts', modules, imports);
    expect(ghosts.map((ghost) => [ghost.id, ghost.collapsed])).toEqual([['group:ext0/dir', 8], ['group:ext1/dir', 7]]);
    expect(shown.every((item) => item.to.startsWith('group:'))).toBe(true);
    expect(shown).toHaveLength(GHOST_LIMIT + 3);
  });
});
