import { describe, expect, it } from 'vitest';

import {
  OTHER_GROUP,
  ROOT_GROUP,
  foldGroupImports,
  groupTree,
  type DeclaredGroup,
  type GroupImport
} from '../server/lib/groups';

/**
 * Дерево групп кодовой карты на всю глубину (ADR-0027, R-0040, T-0092):
 * автогруппы по всему дереву каталогов, объявленные группы с `parent`,
 * импорты, свёрнутые до видимого уровня.
 */

const evidence = { path: 'x.ts', line: 1, fragment: 'x' };
const edge = (from: string, to: string, status?: GroupImport['status']): GroupImport => ({ from, to, evidence, status });
const mod = (path: string) => ({ id: path, path });

describe('groupTree: автогруппы по всему дереву каталогов', () => {
  it('цепочка каталогов без файлов на промежуточных уровнях схлопывается в самый глубокий', () => {
    const tree = groupTree([mod('src/a/b/x.ts'), mod('src/a/b/y.ts')], []);
    expect(tree.nodes.map((n) => n.id)).toEqual(['src/a/b']);
    expect(tree.nodes[0]!.parent).toBeUndefined();
    expect(tree.groupOf('src/a/b/x.ts')).toBe('src/a/b');
  });

  it('ветвление сохраняет уровни: общий каталог остаётся родителем', () => {
    const tree = groupTree([mod('src/a/x.ts'), mod('src/b/y.ts')], []);
    expect(tree.nodes.map((n) => n.id).sort()).toEqual(['src', 'src/a', 'src/b']);
    expect(tree.nodes.find((n) => n.id === 'src/a')!.parent).toBe('src');
    expect(tree.nodes.find((n) => n.id === 'src')!.parent).toBeUndefined();
  });

  it('промежуточный каталог со своим файлом не схлопывается', () => {
    const tree = groupTree([mod('src/x.ts'), mod('src/a/y.ts')], []);
    expect(tree.nodes.map((n) => n.id).sort()).toEqual(['src', 'src/a']);
  });

  it('файл в корне и модуль без пути попадают в служебные группы', () => {
    const tree = groupTree([mod('x.ts'), { id: 'просто' }], []);
    expect(tree.groupOf('x.ts')).toBe(ROOT_GROUP);
    expect(tree.groupOf('просто')).toBe(OTHER_GROUP);
  });

  it('пустая карта — пустое дерево', () => {
    expect(groupTree([], []).nodes).toEqual([]);
  });

  it('конец импорта, которого карта не объявляла, — участник дерева', () => {
    const tree = groupTree([], [edge('a/b/x.ts', 'c/d/y.ts')]);
    expect(tree.nodes).toHaveLength(2);
  });
});

describe('groupTree: объявленные группы на всю глубину', () => {
  const mods = [
    { id: 'm1', path: 'p/one.ts' },
    { id: 'm2', path: 'q/two.ts' }
  ];

  it('parent работает на любую глубину, а не сжимается до верхней', () => {
    const declared: DeclaredGroup[] = [
      { id: 'top' },
      { id: 'mid', parent: 'top' },
      { id: 'low', parent: 'mid', modules: ['m1'] }
    ];
    const tree = groupTree(mods, [], declared);
    expect(tree.groupOf('m1')).toBe('low');
    const parents = Object.fromEntries(tree.nodes.map((n) => [n.id, n.parent]));
    expect(parents['low']).toBe('mid');
    expect(parents['mid']).toBe('top');
    expect(parents['top']).toBeUndefined();
    expect(tree.nodes.find((n) => n.id === 'low')!.auto).toBe(false);
  });

  it('parent в никуда: группа верхняя; цикл в parent не зависает', () => {
    const ghost = groupTree(mods, [], [{ id: 'g', parent: 'нет', modules: ['m1'] }]);
    expect(ghost.nodes.find((n) => n.id === 'g')!.parent).toBeUndefined();
    const loop = groupTree(mods, [], [
      { id: 'a', parent: 'b', modules: ['m1'] },
      { id: 'b', parent: 'a' }
    ]);
    expect(loop.nodes.map((n) => n.id)).toEqual(expect.arrayContaining(['a', 'b']));
  });
});

describe('foldGroupImports: импорты, свёрнутые до уровня дерева групп', () => {
  const mods = [
    { id: 'a1', path: 'src/a/one.ts' },
    { id: 'a2', path: 'src/a/two.ts' },
    { id: 'b1', path: 'src/b/one.ts' },
    { id: 'c1', path: 'lib/c.ts' }
  ];
  const imports = [edge('a1', 'a2', 'ok'), edge('a1', 'b1', 'ok'), edge('a2', 'b1', 'missing'), edge('b1', 'c1', 'stale')];
  const tree = groupTree(mods, imports);

  it('на верхнем уровне: src и lib; внутренние не рисуются, но считаются', () => {
    const r = foldGroupImports(tree, imports, { level: 0 });
    expect(r.internal).toBe(3);
    expect(r.edges).toHaveLength(1);
    expect(r.edges[0]!.count).toBe(1);
    expect(r.edges[0]!.worst).toBe('stale');
  });

  it('на уровне 1 стрелка a → b несёт два импорта и худший вердикт', () => {
    const r = foldGroupImports(tree, imports, { level: 1 });
    const ab = r.edges.find((e) => e.from === 'src/a' && e.to === 'src/b')!;
    expect(ab.count).toBe(2);
    expect(ab.worst).toBe('missing');
    expect(r.importsOf(ab).map((i) => `${i.from}>${i.to}`)).toEqual(['a1>b1', 'a2>b1']);
  });

  it('раскрытие на месте: внутри группы следующий уровень, снаружи — свёрнуто', () => {
    const r = foldGroupImports(tree, imports, { openId: 'src', level: 1 });
    expect(r.edges.some((e) => e.from === 'src/a' && e.to === 'src/b')).toBe(true);
    expect(r.edges.some((e) => e.to === 'lib')).toBe(true);
  });

  it('без импортов — пусто; стрелки и внутренние в сумме равны числу импортов', () => {
    expect(foldGroupImports(tree, [], {})).toMatchObject({ edges: [], internal: 0 });
    const r = foldGroupImports(tree, imports, { level: 1 });
    expect(r.edges.reduce((s, e) => s + e.count, 0) + r.internal).toBe(imports.length);
  });
});
