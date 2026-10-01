import { describe, expect, it } from 'vitest';

import { OTHER_GROUP, autoGroupId, buildGroups, membersOf, worstVerdict, type GroupImport } from '../server/lib/groups';

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
