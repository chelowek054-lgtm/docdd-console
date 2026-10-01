import { describe, expect, it } from 'vitest';

import {
  GHOST_LIMIT,
  OTHER_GROUP,
  ROOT_GROUP,
  autoGroupOf,
  declaredGroupOf,
  ghostNeighbors,
  groupCard,
  groupModules,
  groupScope,
  portsOf,
  worstStatus,
  type DeclaredGroup,
  type GroupImport
} from '../server/lib/groups';
import { evidenceClaims, foldMaps, parseMapRecord } from '../server/lib/maps';

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

describe('объявленные группы', () => {
  const modules = [
    { id: 'server/lib/graph/a.ts', layer: 'ядро' },
    { id: 'server/lib/graph/b.ts', layer: 'ядро' },
    { id: 'server/lib/links.ts', layer: 'ядро' },
    { id: 'server/lib/library/x.ts', layer: 'ядро' },
    { id: 'server/lib/maps.ts', layer: 'ядро' },
    { id: 'app/components/GraphView.vue', layer: 'экраны' },
    { id: 'app/pages/index.vue', layer: 'экраны' }
  ];
  const knowledge: DeclaredGroup = {
    id: 'knowledge',
    title: 'Граф знаний',
    summary: 'Хранит записи и связи.',
    paths: ['server/lib/graph', 'server/lib/links.ts'],
    modules: ['app/components/GraphView.vue'],
    capability: 'knowledge-graph',
    declaredBy: 'M-0010'
  };
  const idsOf = (grouping: ReturnType<typeof groupModules>, id: string) =>
    grouping.byId.get(id)?.members.map((member) => member.id).sort();

  it('paths собирает модули по префиксу — по границе сегмента, поимённый modules — поверх', () => {
    const grouping = groupModules(modules, [], [knowledge]);
    expect(idsOf(grouping, 'knowledge')).toEqual([
      'app/components/GraphView.vue', 'server/lib/graph/a.ts', 'server/lib/graph/b.ts', 'server/lib/links.ts'
    ]);
    // `server/lib/library` не захвачен префиксом `server/lib/graph`, остальные — по автоправилу.
    expect(grouping.groupOf('server/lib/library/x.ts')).toBe('server/lib');
    expect(grouping.groupOf('app/pages/index.vue')).toBe('app/pages');
  });

  it('объявленная группа несёт название, описание, возможность и карту-автора; она не «авто»', () => {
    const group = groupModules(modules, [], [knowledge]).byId.get('knowledge');
    expect(group).toMatchObject({
      title: 'Граф знаний', summary: 'Хранит записи и связи.', capability: 'knowledge-graph', declaredBy: 'M-0010', auto: false
    });
    const card = groupCard(groupModules(modules, [], [knowledge]), 'knowledge');
    expect(card).toMatchObject({ auto: false, capability: 'knowledge-graph', declaredBy: 'M-0010', moduleCount: 4 });
  });

  it('сильнее всего поимённый modules, затем самый длинный префикс, затем автогруппа', () => {
    const broad: DeclaredGroup = { id: 'broad', paths: ['server/lib'] };
    const narrow: DeclaredGroup = { id: 'narrow', paths: ['server/lib/graph'] };
    const named: DeclaredGroup = { id: 'named', modules: ['server/lib/graph/a.ts'] };
    const grouping = groupModules(modules, [], [named, broad, narrow]);
    expect(grouping.groupOf('server/lib/graph/a.ts')).toBe('named');
    expect(grouping.groupOf('server/lib/graph/b.ts')).toBe('narrow');
    expect(grouping.groupOf('server/lib/maps.ts')).toBe('broad');
    expect(grouping.groupOf('app/pages/index.vue')).toBe('app/pages');
  });

  it('равные правила, называющие разные группы, — побеждает объявленное позже', () => {
    const a: DeclaredGroup = { id: 'a', paths: ['server/lib'] };
    const b: DeclaredGroup = { id: 'b', paths: ['server/lib'] };
    expect(groupModules(modules, [], [a, b]).groupOf('server/lib/maps.ts')).toBe('b');
    expect(groupModules(modules, [], [b, a]).groupOf('server/lib/maps.ts')).toBe('a');
    const byName = groupModules(modules, [], [{ id: 'x', modules: ['server/lib/maps.ts'] }, { id: 'y', modules: ['server/lib/maps.ts'] }]);
    expect(byName.groupOf('server/lib/maps.ts')).toBe('y');
  });

  it('пустая группа не рисуется', () => {
    const grouping = groupModules(modules, [], [{ id: 'empty', paths: ['нет/такого'] }]);
    expect(grouping.byId.has('empty')).toBe(false);
  });

  it('вложенность: модули подгруппы относятся к самой верхней группе; parent в никуда — группа верхняя', () => {
    const grouping = groupModules(modules, [], [
      { id: 'top', title: 'Верх' },
      { id: 'mid', parent: 'top', paths: ['server/lib/graph'] },
      { id: 'low', parent: 'mid', modules: ['server/lib/links.ts'] },
      { id: 'lost', parent: 'нет', modules: ['server/lib/maps.ts'] }
    ]);
    expect(grouping.groupOf('server/lib/graph/a.ts')).toBe('top');
    expect(grouping.groupOf('server/lib/links.ts')).toBe('top');
    expect(grouping.groupOf('server/lib/maps.ts')).toBe('lost');
    expect(grouping.byId.has('mid')).toBe(false);
  });

  it('цикл в parent не зависает', () => {
    expect(() => groupModules(modules, [], [
      { id: 'a', parent: 'b', paths: ['server/lib'] },
      { id: 'b', parent: 'a' }
    ])).not.toThrow();
  });

  it('связи считаются между объявленными группами так же, как между автоматическими', () => {
    const grouping = groupModules(modules, [
      edge('app/components/GraphView.vue', 'server/lib/graph/a.ts'),
      edge('app/pages/index.vue', 'server/lib/graph/b.ts'),
      edge('server/lib/graph/a.ts', 'server/lib/graph/b.ts')
    ], [knowledge]);
    expect(grouping.links).toEqual([
      expect.objectContaining({ from: 'app/pages', to: 'knowledge' })
    ]);
  });

  it('declaredGroupOf: id — путь, когда path не задан', () => {
    expect(declaredGroupOf({ id: 'server/lib/graph/a.ts' }, [knowledge])).toBe('knowledge');
    expect(declaredGroupOf({ id: 'plain-name' }, [knowledge])).toBeNull();
  });
});

describe('groups в карте: разбор и сложение', () => {
  const block = (change: unknown) => ['```docdd-codemap', JSON.stringify(change), '```'].join('\n');

  it('блок только с groups проходит схему — так отвечает модель на «Сгруппировать модули»', () => {
    const parsed = parseMapRecord(block({ added: { groups: [{ id: 'knowledge', title: 'Граф знаний', paths: ['server/lib/graph'] }] } }));
    expect(parsed.problems).toEqual([]);
    expect(parsed.change.codemap?.added?.groups).toHaveLength(1);
  });

  it('незнакомое поле и не-строка в paths схема отвергает', () => {
    expect(parseMapRecord(block({ added: { groups: [{ id: 'a', colour: 'red' }] } })).problems).toHaveLength(1);
    expect(parseMapRecord(block({ added: { groups: [{ id: 'a', paths: [1] }] } })).problems).toHaveLength(1);
    expect(parseMapRecord(block({ added: { groups: [{ title: 'без id' }] } })).problems).toHaveLength(1);
  });

  it('повторное объявление — уточнение; removed убирает по id; declaredBy — карта-автор', () => {
    const folded = foldMaps([
      { id: 'M-0001', change: { codemap: { added: { groups: [{ id: 'a', title: 'Первое' }, { id: 'b' }] } } } },
      { id: 'M-0002', change: { codemap: { added: { groups: [{ id: 'a', title: 'Второе' }] }, removed: { groups: [{ id: 'b' }] } } } }
    ]);
    expect(folded.codemap.groups).toEqual([{ id: 'a', title: 'Второе', declaredBy: 'M-0002' }]);
  });

  it('группы не участвуют в сверке: у них нет свидетельства', () => {
    expect(evidenceClaims({ codemap: { added: { groups: [{ id: 'a' }] } } })).toEqual([]);
  });

  it('сложенные группы управляют обзором: объявленная получает название и автора', () => {
    const folded = foldMaps([{ id: 'M-0010', change: { codemap: { added: {
      modules: [{ id: 'server/lib/graph/a.ts' }, { id: 'app/pages/x.vue' }],
      groups: [{ id: 'knowledge', title: 'Граф знаний', paths: ['server/lib/graph'] }]
    } } } }]);
    const grouping = groupModules(folded.codemap.modules, folded.codemap.imports, folded.codemap.groups);
    expect(grouping.byId.get('knowledge')).toMatchObject({ title: 'Граф знаний', auto: false, declaredBy: 'M-0010' });
    expect(grouping.byId.get('app/pages')?.auto).toBe(true);
  });
});
