import { describe, expect, it } from 'vitest';

import { flowContext, foldFlows, type FlowItem } from '../server/lib/flow-groups';
import { groupModules, groupTree } from '../server/lib/groups';

/** R-0040 / ADR-0027: потоки данных на любой глубине, parent у источников. */
const evidence = { path: 'x.ts', line: 1, fragment: 'x' };
const flow = (from: string, to: string, direction = 'read', status?: FlowItem['status']): FlowItem => ({ from, to, direction, evidence, status });

const modules = [
  { id: 'server/lib/a.ts', path: 'server/lib/a.ts' },
  { id: 'server/lib/b.ts', path: 'server/lib/b.ts' },
  { id: 'server/api/x.ts', path: 'server/api/x.ts' }
];
const sources = [
  { id: 'storage', kind: 'group' },
  { id: 'index.json', kind: 'file', parent: 'storage' },
  { id: 'cache.db', kind: 'db', parent: 'storage' },
  { id: 'mq', kind: 'queue' }
];
const ctx = flowContext(groupModules(modules, []), [], sources);
const flows = [
  flow('server/lib/a.ts', 'index.json', 'read'),
  flow('server/lib/b.ts', 'cache.db', 'write', 'missing'),
  flow('server/api/x.ts', 'mq', 'read')
];

describe('свёртка потоков по parent источников', () => {
  it('на уровне 0 источники сворачиваются в родителя, число потоков и направление сходятся', () => {
    const r = foldFlows(flows, ctx, { codeLevel: 99, sourceLevel: 0 });
    const toStorage = r.links.filter((l) => l.to === 'storage');
    expect(toStorage.map((l) => l.from).sort()).toEqual(['server/lib/a.ts', 'server/lib/b.ts']);
    expect(r.links.find((l) => l.to === 'mq')?.count).toBe(1);
  });

  it('несколько потоков в один узел: count, смесь направлений и худший статус', () => {
    const two = [flow('server/lib/a.ts', 'index.json', 'read'), flow('server/lib/a.ts', 'cache.db', 'write', 'missing')];
    const r = foldFlows(two, ctx, { codeLevel: 99, sourceLevel: 0 });
    expect(r.links).toHaveLength(1);
    expect(r.links[0]).toMatchObject({ from: 'server/lib/a.ts', to: 'storage', count: 2, direction: 'both', status: 'missing' });
    expect(r.links[0]!.flows).toHaveLength(2);
  });

  it('уровень источников 1 возвращает детей, свёртка разворачивается до исходных потоков', () => {
    const r = foldFlows(flows, ctx, { codeLevel: 99, sourceLevel: 1 });
    expect(r.links.map((l) => l.to).sort()).toEqual(['cache.db', 'index.json', 'mq']);
    expect(r.links.reduce((n, l) => n + l.flows.length, 0)).toBe(flows.length);
  });

  it('концы-модули сворачиваются до группы кода на уровне 0', () => {
    const r = foldFlows(flows, ctx, { codeLevel: 0, sourceLevel: 0 });
    const lib = r.links.find((l) => l.from === 'server/lib' && l.to === 'storage');
    expect(lib?.count).toBe(2);
  });

  it('уровни кодовой карты берутся из дерева групп, если его передали', () => {
    const tree = groupTree(modules, []);
    const deep = foldFlows(flows, ctx, { codeLevel: 0, sourceLevel: 0, groupTree: tree });
    const top = tree.nodes.find((n) => !n.parent)!;
    expect(deep.links.every((l) => l.from === top.id || tree.nodes.some((n) => n.id === l.from))).toBe(true);
    const leaves = foldFlows(flows, ctx, { codeLevel: 99, sourceLevel: 0, groupTree: tree });
    expect(leaves.links.map((l) => l.from)).toContain('server/lib/a.ts');
  });

  it('цикл parent и источник-призрак не роняют расчёт', () => {
    const odd = flowContext(groupModules(modules, []), [], [
      { id: 'a', kind: 'file', parent: 'b' }, { id: 'b', kind: 'file', parent: 'a' }, { id: 'c', kind: 'file', parent: 'нет' }
    ]);
    const r = foldFlows([flow('server/lib/a.ts', 'a'), flow('server/lib/b.ts', 'c')], odd, { codeLevel: 99, sourceLevel: 0 });
    expect(r.links).toHaveLength(2);
  });

  it('пустые потоки дают пустой результат', () => {
    expect(foldFlows([], ctx, { codeLevel: 0, sourceLevel: 0 })).toEqual({ links: [], internal: 0 });
  });
});
