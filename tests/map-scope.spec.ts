import { expect, it } from 'vitest';
import { mapScope } from '../app/utils/map-scope';
import { lintMapParents } from '../server/lib/map-core';
import { currentEvidenceClaims, type MapChange } from '../server/lib/maps';

it('limits depth to descendants of the open group', () => {
  const nodes = [
    { id: 'a' }, { id: 'b', parent: 'a' }, { id: 'c', parent: 'b' }, { id: 'd', parent: 'c' },
    { id: 'other' }, { id: 'child', parent: 'other' }
  ];
  expect(mapScope(nodes, [], undefined, 1).nodes.map(({ id }) => id)).toEqual(['a', 'other']);
  expect(mapScope(nodes, [], undefined, 2).nodes.map(({ id }) => id)).toContain('b');
  const open = mapScope(nodes, [], 'b', 9);
  expect(open.path.map(({ id }) => id)).toEqual(['a', 'b']);
  expect(open.maxDepth).toBe(2);
  expect(open.level).toBe(2);
  expect(open.nodes.map(({ id }) => id)).toEqual(['d']);
});

it('counts links across the whole group and preserves original ends across levels', () => {
  const nodes = [
    { id: 'server' }, { id: 'assist', parent: 'server' }, { id: 'retrieve', parent: 'assist' },
    { id: 'index', parent: 'assist' }, { id: 'external' }, { id: 'model', parent: 'external' }
  ];
  const edges = [
    { from: 'retrieve', to: 'model', type: 'call', summary: 'Find' },
    { from: 'index', to: 'model', type: 'call', summary: 'Index' },
    { from: 'model', to: 'retrieve', type: 'data', summary: 'Result' },
    { from: 'retrieve', to: 'index', type: 'call', summary: 'Read' }
  ];
  const top = mapScope(nodes, edges, undefined);
  expect(top.nodes.map((node) => node.id)).toEqual(['server', 'external']);
  expect(top.groups.get('server')).toEqual({ children: 1, incoming: 1, outgoing: 2 });
  expect(top.edges[0]).toMatchObject({ from: 'server', to: 'external', summary: '2', members: edges.slice(0, 2) });
  const inside = mapScope(nodes, edges, 'assist');
  expect(inside.path.map((node) => node.id)).toEqual(['server', 'assist']);
  expect([...inside.outside]).toEqual(['external']);
  expect(inside.edges.map(({ from, to }) => [from, to])).toContainEqual(['retrieve', 'index']);
});

it('rejects cycles and deleting a group that still has children', () => {
  const nodes = [{ id: 'a' }, { id: 'b', parent: 'a' }];
  expect(lintMapParents([{ id: 'a', parent: 'b' }], [], nodes)).toContainEqual(expect.objectContaining({ field: 'parent' }));
  expect(lintMapParents([], [{ id: 'a' }], nodes)).toContainEqual(expect.objectContaining({ target: 'b' }));
  expect(lintMapParents([{ id: 'b' }], [{ id: 'a' }], nodes)).toEqual([]);
});

it('renders expanded groups only as frames, retaining direct links to their IDs', () => {
  const nodes = [
    { id: 'client' }, { id: 'screen', parent: 'client' },
    { id: 'server' }, { id: 'entry', parent: 'server' }, { id: 'api', parent: 'entry' }
  ];
  const relation = { from: 'client', to: 'server', type: 'calls' };
  expect(mapScope(nodes, [relation], undefined, 2).nodes.map(({ id }) => id)).toEqual(['screen', 'entry']);
  const deep = mapScope(nodes, [relation], undefined, 3);
  expect(deep.nodes.map(({ id }) => id)).toEqual(['screen', 'api']);
  expect(deep.edges).toMatchObject([{ ...relation, members: [relation] }]);
  expect(mapScope(nodes, [relation], 'server', 2).nodes.map(({ id }) => id)).toEqual(['client', 'api']);
});

it('checks an explicit removal against the source without rechecking the earlier active claim', () => {
  const imports = [{ from: 'a', to: 'b', evidence: { path: 'a.ts', line: 1, fragment: 'import b' } }];
  const first: MapChange = { codemap: { added: { imports } } };
  const second: MapChange = { codemap: { removed: { imports } } };
  const active = currentEvidenceClaims([{ id: 'first', change: first }, { id: 'second', change: second }]);
  expect(active.get('first')).toEqual([]);
  expect(active.get('second')).toContainEqual(expect.objectContaining({ side: 'removed' }));
});
