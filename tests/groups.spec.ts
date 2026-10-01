import { describe, expect, it } from 'vitest';

import {
  OTHER_GROUP, autoGroupId, buildGroups, membersOf, ungroupedModules, worstVerdict, type GroupImport
} from '../server/lib/groups';

/**
 * Группы кодовой карты (docs/07-maps.md, «Группы: уровень над модулями»).
 */

describe('autoGroupId', () => {
  it('отбрасывает имя файла и берёт первые два сегмента каталога', () => {
    expect(autoGroupId({ id: 'a', path: 'server/lib/maps.ts' })).toBe('server/lib');
    expect(autoGroupId({ id: 'a', path: 'app/pages/projects/[id]/tasks.vue' })).toBe('app/pages');
    expect(autoGroupId({ id: 'a', path: 'src/main.py' })).toBe('src');
  });

  it('нет path, а id похож на путь — берётся id', () => {
    expect(autoGroupId({ id: 'server/utils/http.ts' })).toBe('server/utils');
  });

  it('dotted-имя пакета: последний сегмент (модуль) отбрасывается, из остатка первые два', () => {
    expect(autoGroupId({ id: 'gastrograf.catalog.usda' })).toBe('gastrograf.catalog');
    expect(autoGroupId({ id: 'a.b.c.d.e' })).toBe('a.b');
    expect(autoGroupId({ id: 'pkg.mod' })).toBe('pkg');
  });

  it('файл в корне и голое имя без разделителей — Прочее', () => {
    expect(autoGroupId({ id: 'a', path: 'nuxt.config.ts' })).toBe(OTHER_GROUP);
    expect(autoGroupId({ id: 'standalone' })).toBe(OTHER_GROUP);
  });

  it('path важнее id: id может быть логическим именем', () => {
    expect(autoGroupId({ id: 'maps-core', path: 'server/lib/maps.ts' })).toBe('server/lib');
  });
});

describe('worstVerdict', () => {
  it('ok только когда все ok; нет вердикта — не повод для тревоги', () => {
    expect(worstVerdict(['ok', 'ok'])).toBe('ok');
    expect(worstVerdict([undefined, 'ok'])).toBe('ok');
    expect(worstVerdict([])).toBe('ok');
  });

  it('не сошёлся хоть один — стрелка тоже, и missing хуже stale; pending — если ничего хуже нет', () => {
    expect(worstVerdict(['ok', 'stale'])).toBe('stale');
    expect(worstVerdict(['stale', 'missing', 'ok'])).toBe('missing');
    expect(worstVerdict(['ok', 'pending'])).toBe('pending');
    expect(worstVerdict(['pending', 'stale'])).toBe('stale');
  });
});

const modules = [
  { id: 'server/lib/a.ts', path: 'server/lib/a.ts' },
  { id: 'server/lib/b.ts', path: 'server/lib/b.ts' },
  { id: 'server/api/x.ts', path: 'server/api/x.ts' },
  { id: 'app/pages/p.vue', path: 'app/pages/p.vue' },
  { id: 'nuxt.config.ts', path: 'nuxt.config.ts' }
];

describe('buildGroups', () => {
  it('раскладывает модули по автогруппам; крупные первыми', () => {
    const model = buildGroups(modules, []);
    expect(model.groups.map((group) => [group.id, group.modules.length])).toEqual([
      ['server/lib', 2],
      ['app/pages', 1],
      ['server/api', 1],
      [OTHER_GROUP, 1]
    ]);
    expect(model.groups.every((group) => group.auto)).toBe(true);
    expect(model.groupOf.get('server/lib/a.ts')).toBe('server/lib');
    expect(membersOf(model, 'server/lib')).toEqual(['server/lib/a.ts', 'server/lib/b.ts']);
    expect(membersOf(model, 'нет-такой')).toEqual([]);
  });

  it('модуль, названный только в импорте, тоже получает группу', () => {
    const model = buildGroups([], [{ from: 'server/lib/a.ts', to: 'server/utils/z.ts' }]);
    expect(model.groupOf.get('server/utils/z.ts')).toBe('server/utils');
    expect(model.groups.map((group) => group.id).sort()).toEqual(['server/lib', 'server/utils']);
  });

  it('импорты между модулями двух групп сворачиваются в одну стрелку с числом', () => {
    const imports: GroupImport[] = [
      { from: 'server/api/x.ts', to: 'server/lib/a.ts', status: 'ok' },
      { from: 'server/api/x.ts', to: 'server/lib/b.ts', status: 'ok' }
    ];
    const model = buildGroups(modules, imports);
    expect(model.links).toHaveLength(1);
    expect(model.links[0]).toMatchObject({ from: 'server/api', to: 'server/lib', count: 2, status: 'ok', cycle: false });
    expect(model.links[0]?.imports).toHaveLength(2);
  });

  it('импорт внутри группы стрелкой не становится', () => {
    const model = buildGroups(modules, [{ from: 'server/lib/a.ts', to: 'server/lib/b.ts' }]);
    expect(model.links).toEqual([]);
    expect(model.ports.size).toBe(0);
  });

  it('вердикт стрелки — худший из свёрнутых: сверка не теряется при свёртке', () => {
    const model = buildGroups(modules, [
      { from: 'server/api/x.ts', to: 'server/lib/a.ts', status: 'ok' },
      { from: 'server/api/x.ts', to: 'server/lib/b.ts', status: 'stale' }
    ]);
    expect(model.links[0]?.status).toBe('stale');
  });

  it('цикл между группами подсвечивается на обеих стрелках; стрелка вне круга — нет', () => {
    const model = buildGroups(modules, [
      { from: 'server/api/x.ts', to: 'server/lib/a.ts' },
      { from: 'server/lib/b.ts', to: 'server/api/x.ts' },
      { from: 'app/pages/p.vue', to: 'server/api/x.ts' }
    ]);
    const byPair = Object.fromEntries(model.links.map((link) => [`${link.from}>${link.to}`, link.cycle]));
    expect(byPair).toEqual({
      'server/api>server/lib': true,
      'server/lib>server/api': true,
      'app/pages>server/api': false
    });
  });

  it('порты — модули с импортом через границу; публичная поверхность — те, что импортируют снаружи', () => {
    const model = buildGroups(modules, [
      { from: 'server/api/x.ts', to: 'server/lib/a.ts' },
      { from: 'server/lib/b.ts', to: 'app/pages/p.vue' }
    ]);
    expect(model.ports.get('server/api/x.ts')).toEqual({ out: 1, in: 0 });
    expect(model.ports.get('server/lib/a.ts')).toEqual({ out: 0, in: 1 });
    expect(model.ports.get('server/lib/b.ts')).toEqual({ out: 1, in: 0 });
    expect(model.ports.has('nuxt.config.ts')).toBe(false);
    // Поверхность группы — то, что импортируют снаружи, а не всё, что имеет внешние связи.
    expect(model.surface.get('server/lib')).toEqual(['server/lib/a.ts']);
    expect(model.surface.get('app/pages')).toEqual(['app/pages/p.vue']);
    expect(model.surface.has('server/api')).toBe(false);
  });

  it('пустая карта — пустая модель, а не ошибка', () => {
    const model = buildGroups([], []);
    expect(model.groups).toEqual([]);
    expect(model.links).toEqual([]);
  });
});

describe('объявленные группы: приоритет и состав', () => {
  const mods = [
    { id: 'server/lib/graph/a.ts', path: 'server/lib/graph/a.ts' },
    { id: 'server/lib/graph/b.ts', path: 'server/lib/graph/b.ts' },
    { id: 'server/lib/graphics.ts', path: 'server/lib/graphics.ts' },
    { id: 'server/lib/other.ts', path: 'server/lib/other.ts' },
    { id: 'app/pages/graph.vue', path: 'app/pages/graph.vue' },
    { id: 'app/pages/home.vue', path: 'app/pages/home.vue' }
  ];

  it('по префиксу: новый файл в каталоге попадает в группу сам', () => {
    const model = buildGroups(mods, [], [{ id: 'graph', title: 'Граф знаний', paths: ['server/lib/graph/', 'app/pages/graph'] }]);
    expect(membersOf(model, 'graph')).toEqual(['server/lib/graph/a.ts', 'server/lib/graph/b.ts', 'app/pages/graph.vue']);
    expect(model.memberSource.get('server/lib/graph/a.ts')).toBe('prefix');
    expect(model.groups.find((group) => group.id === 'graph')).toMatchObject({ title: 'Граф знаний', auto: false });
  });

  it('поимённо сильнее префикса, префикс — сильнее пути', () => {
    const model = buildGroups(mods, [], [
      { id: 'graph', paths: ['server/lib/graph/'] },
      { id: 'misc', modules: ['server/lib/graph/b.ts'] }
    ]);
    expect(model.groupOf.get('server/lib/graph/a.ts')).toBe('graph');
    expect(model.groupOf.get('server/lib/graph/b.ts')).toBe('misc');
    expect(model.memberSource.get('server/lib/graph/b.ts')).toBe('named');
    // Не названное и не пойманное остаётся в автогруппе: объявленные и автоматические работают вместе.
    expect(model.groupOf.get('server/lib/other.ts')).toBe('server/lib');
    expect(model.groups.find((group) => group.id === 'server/lib')?.auto).toBe(true);
  });

  it('самый длинный префикс побеждает, равные — позже объявленная', () => {
    const wide = buildGroups(mods, [], [{ id: 'lib', paths: ['server/lib/'] }, { id: 'graph', paths: ['server/lib/graph/'] }]);
    expect(wide.groupOf.get('server/lib/graph/a.ts')).toBe('graph');
    expect(wide.groupOf.get('server/lib/other.ts')).toBe('lib');

    const tie = buildGroups(mods, [], [{ id: 'first', paths: ['server/lib/other'] }, { id: 'second', paths: ['server/lib/other'] }]);
    expect(tie.groupOf.get('server/lib/other.ts')).toBe('second');
  });

  it('назван в двух группах — побеждает объявленная последней', () => {
    const model = buildGroups(mods, [], [
      { id: 'a', modules: ['server/lib/other.ts'] },
      { id: 'b', modules: ['server/lib/other.ts'] }
    ]);
    expect(model.groupOf.get('server/lib/other.ts')).toBe('b');
  });

  it('группа без единого модуля не показывается', () => {
    const model = buildGroups(mods, [], [{ id: 'empty', paths: ['нет/такого/'] }]);
    expect(model.groups.some((group) => group.id === 'empty')).toBe(false);
  });

  it('автогруппа с тем же id, что у объявленной, — та же группа', () => {
    const model = buildGroups(mods, [], [{ id: 'server/lib', title: 'Серверное ядро', modules: ['server/lib/other.ts'] }]);
    const group = model.groups.find((item) => item.id === 'server/lib');
    expect(group?.title).toBe('Серверное ядро');
    expect(group?.modules.sort()).toEqual([
      'server/lib/graph/a.ts', 'server/lib/graph/b.ts', 'server/lib/graphics.ts', 'server/lib/other.ts'
    ].sort());
    expect(group?.sources).toEqual({ named: 1, prefix: 0, auto: 3 });
  });

  it('«ещё не сгруппировано» — модули без объявленной группы', () => {
    const model = buildGroups(mods, [], [{ id: 'graph', paths: ['server/lib/graph/'] }]);
    expect(ungroupedModules(model).sort()).toEqual([
      'app/pages/graph.vue', 'app/pages/home.vue', 'server/lib/graphics.ts', 'server/lib/other.ts'
    ]);
    const all = buildGroups(mods, [], [{ id: 'everything', paths: ['server/', 'app/'] }]);
    expect(ungroupedModules(all)).toEqual([]);
  });
});

describe('объявленные группы: вложенность и подписи связей', () => {
  const mods = [
    { id: 'g/core/a.ts', path: 'g/core/a.ts' },
    { id: 'g/ui/b.ts', path: 'g/ui/b.ts' },
    { id: 'x/y/c.ts', path: 'x/y/c.ts' }
  ];

  it('вложенная группа считается внутри родителя: узел обзора — группа верхнего уровня', () => {
    const model = buildGroups(mods, [], [
      { id: 'graph', title: 'Граф' },
      { id: 'graph-core', parent: 'graph', paths: ['g/core/'] },
      { id: 'graph-ui', parent: 'graph', paths: ['g/ui/'] }
    ]);
    expect(model.groups.map((group) => group.id)).toEqual(['graph', 'x/y']);
    const graph = model.groups[0];
    expect(graph?.modules.sort()).toEqual(['g/core/a.ts', 'g/ui/b.ts']);
    expect(graph?.children.sort()).toEqual(['graph-core', 'graph-ui']);
    expect(model.groupOf.get('g/core/a.ts')).toBe('graph');
  });

  it('родителя нет в карте или круг из parent — верхний уровень, а не потерянная группа', () => {
    const orphan = buildGroups(mods, [], [{ id: 'core', parent: 'нет-такого', paths: ['g/core/'] }]);
    expect(orphan.groupOf.get('g/core/a.ts')).toBe('core');

    const circle = buildGroups(mods, [], [
      { id: 'a', parent: 'b', paths: ['g/core/'] },
      { id: 'b', parent: 'a', paths: ['g/ui/'] }
    ]);
    expect(circle.groupOf.get('g/core/a.ts')).toBe('a');
    expect(circle.groupOf.get('g/ui/b.ts')).toBe('b');
  });

  it('подпись связи берётся из links группы-источника, в том числе вложенной', () => {
    const imports: GroupImport[] = [{ from: 'g/core/a.ts', to: 'x/y/c.ts' }];
    const model = buildGroups(mods, imports, [
      { id: 'graph' },
      { id: 'graph-core', parent: 'graph', paths: ['g/core/'], links: [{ to: 'x/y', summary: 'читает граф знаний' }] }
    ]);
    expect(model.links).toHaveLength(1);
    expect(model.links[0]).toMatchObject({ from: 'graph', to: 'x/y', summary: 'читает граф знаний' });
  });

  it('связь без подписи остаётся числом', () => {
    const model = buildGroups(mods, [{ from: 'g/core/a.ts', to: 'x/y/c.ts' }], [{ id: 'graph', paths: ['g/'] }]);
    expect(model.links[0]?.summary).toBeUndefined();
  });
});
