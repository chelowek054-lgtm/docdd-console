import { describe, expect, it } from 'vitest';

import {
  FLOW_GHOST_LIMIT,
  SCREENS_GROUP,
  UNKNOWN_KIND,
  codeGroupOf,
  codeGroupScope,
  flowContext,
  flowGhosts,
  groupFlows,
  kindOf,
  kindScope,
  mergeDirections,
  type FlowItem
} from '../server/lib/flow-groups';
import { groupModules } from '../server/lib/groups';

/**
 * Группы на потоках данных (docs/07-maps.md, «Потоки данных», «Группы и
 * здесь»).
 */

const evidence = { path: 'x.ts', line: 1, fragment: 'x' };
const flow = (from: string, to: string, direction = 'read', status?: FlowItem['status']): FlowItem => ({ from, to, direction, evidence, status });

const modules = [
  { id: 'server/lib/a.ts' }, { id: 'server/lib/b.ts' }, { id: 'server/api/x.ts' }, { id: 'cli/check.ts' }
];
const grouping = groupModules(modules, []);
const sources = [
  { id: 'index.json', kind: 'file' },
  { id: 'cache.db', kind: 'db' },
  { id: 'mq', kind: 'queue' },
  { id: 'users', kind: 'db' }
];
const context = flowContext(grouping, [{ id: '/cart' }], sources);

describe('к какой группе относится конец потока', () => {
  it('модуль — группа его модуля; экран — Экраны; всё прочее — Прочее', () => {
    expect(codeGroupOf('server/lib/a.ts', context)).toBe('server/lib');
    expect(codeGroupOf('/cart', context)).toBe(SCREENS_GROUP);
    expect(codeGroupOf('что-то-неизвестное', context)).toBe('Прочее');
  });

  it('источник — по kind; необъявленный — «не опознан»', () => {
    expect(kindOf('cache.db', context)).toBe('db');
    expect(kindOf('нет-такого', context)).toBe(UNKNOWN_KIND);
  });
});

describe('направление свёрнутой связи', () => {
  it('both, если есть both либо и read, и write', () => {
    expect(mergeDirections(['read', 'write'])).toBe('both');
    expect(mergeDirections(['read', 'both'])).toBe('both');
    expect(mergeDirections(['read', 'read'])).toBe('read');
    expect(mergeDirections(['write'])).toBe('write');
  });
});

describe('groupFlows — обзор «группы кода ↔ виды источников»', () => {
  const flows = [
    flow('server/lib/a.ts', 'cache.db', 'read'),
    flow('server/lib/b.ts', 'users', 'write', 'stale'),
    flow('server/lib/a.ts', 'index.json', 'write'),
    flow('/cart', 'users', 'read'),
    flow('server/api/x.ts', 'mq', 'both')
  ];
  const result = groupFlows(flows, context);

  it('потоки одной группы к источникам одного вида — одна связь с числом потоков', () => {
    const link = result.links.find((item) => item.codeGroup === 'server/lib' && item.kind === 'db');
    expect(link?.flows).toHaveLength(2);
    expect(link?.direction).toBe('both');
  });

  it('расхождение хоть в одном потоке краснит связь', () => {
    expect(result.links.find((item) => item.codeGroup === 'server/lib' && item.kind === 'db')?.status).toBe('stale');
    expect(result.links.find((item) => item.codeGroup === SCREENS_GROUP)?.status).toBe('ok');
  });

  it('группы кода и виды — только те, у которых есть потоки', () => {
    expect(result.codeGroups.map((group) => [group.id, group.flows])).toEqual([
      [SCREENS_GROUP, 1], ['server/api', 1], ['server/lib', 3]
    ]);
    expect(result.kinds).toEqual([
      { kind: 'db', sources: 2 }, { kind: 'file', sources: 1 }, { kind: 'queue', sources: 1 }
    ]);
  });
});

describe('вид группы кода и вид источников', () => {
  const flows = [
    flow('server/lib/a.ts', 'cache.db'), flow('server/api/x.ts', 'cache.db'),
    flow('server/api/x.ts', 'mq'), flow('cli/check.ts', 'index.json')
  ];

  it('группа кода: её потоки и источники, которых они касаются', () => {
    const scope = codeGroupScope(context, 'server/api', flows);
    expect(scope.flows).toHaveLength(2);
    expect(scope.sources.map((source) => source.id).sort()).toEqual(['cache.db', 'mq']);
  });

  it('вид источников: источники этого вида и потоки к ним из любых групп', () => {
    const scope = kindScope(context, 'db', flows);
    expect(scope.sources.map((source) => source.id)).toEqual(['cache.db']);
    expect(scope.flows.map((item) => item.from).sort()).toEqual(['server/api/x.ts', 'server/lib/a.ts']);
  });
});

describe('flowGhosts — чужие модули, трогающие тот же источник', () => {
  const flows = [
    flow('server/lib/a.ts', 'cache.db'),
    flow('server/api/x.ts', 'cache.db'),
    flow('cli/check.ts', 'cache.db'),
    flow('cli/check.ts', 'index.json')
  ];

  it('выбран модуль — призраки по его источникам, в группе — не призрак', () => {
    const { ghosts, flows: shown } = flowGhosts(context, 'server/lib', 'server/lib/a.ts', flows);
    expect(ghosts.map((ghost) => ghost.id).sort()).toEqual(['cli/check.ts', 'server/api/x.ts']);
    // Другой его источник (`index.json`) чужим потоком не задет — призраком не станет.
    expect(shown.every((item) => item.to === 'cache.db')).toBe(true);
  });

  it('выбран источник — призраки по нему', () => {
    const { ghosts } = flowGhosts(context, 'server/lib', 'cache.db', flows);
    expect(ghosts.map((ghost) => ghost.id).sort()).toEqual(['cli/check.ts', 'server/api/x.ts']);
  });

  it('больше порога — сворачиваются в узлы-группы', () => {
    const many = Array.from({ length: FLOW_GHOST_LIMIT + 2 }, (_, index) => `ext${index % 2}/dir/m${index}.ts`);
    const wide = flowContext(groupModules([{ id: 'server/lib/a.ts' }, ...many.map((id) => ({ id }))], []), [], sources);
    const outside = many.map((id) => flow(id, 'cache.db'));
    const { ghosts, flows: shown } = flowGhosts(wide, 'server/lib', 'cache.db', [flow('server/lib/a.ts', 'cache.db'), ...outside]);
    expect(ghosts.map((ghost) => [ghost.id, ghost.collapsed])).toEqual([['group:ext0/dir', 7], ['group:ext1/dir', 7]]);
    expect(shown.every((item) => item.from.startsWith('group:'))).toBe(true);
  });
});
