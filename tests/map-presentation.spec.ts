import { expect, it } from 'vitest';
import { compactMapFrame, filterMapRelations, frameCollision, frameMembers, mapLinkAppearance, relationLevel, simpleMapLines, mapFrames, mapSvg, spaceMapGroups } from '../app/utils/map-presentation';
import { flowNode, NODE_HEIGHT, NODE_WIDTH } from '../app/utils/map-flow';
import { lintMapConnectivity } from '../server/lib/map-connectivity';
import { standardFor } from '../server/lib/map-core';
import { emptyProjectMap } from '../server/lib/maps';

it('exports a two-way line and a group frame without the external node', () => {
  const standard = standardFor('domain')!.standard;
  const data = [{ id: 'g', title: 'Group' }, { id: 'a', title: 'A & B', parent: 'g' }, { id: 'b', title: 'Outside' }];
  const nodes = [flowNode(data[1]!, standard, 'light'), { ...flowNode(data[2]!, standard, 'light'), position: { x: 400, y: 0 } }];
  const lines = simpleMapLines([{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }], () => false, () => 1);
  expect(lines).toMatchObject([{ from: 'a', to: 'b', count: 2, twoWay: true }]);
  const frames = mapFrames(data, nodes, new Set(['b']));
  expect(frames[0]?.right).toBeLessThan(400);
  const svg = mapSvg(nodes, lines, frames, standard, false);
  expect(svg).toContain('marker-start="url(#arrow)"');
  expect(svg).toContain('A &amp; B');
  expect(svg).toContain('Group');
});

it('styles a collapsed connection by its shallowest visible original link', () => {
  const levels = new Map([['client', 1], ['server', 1], ['client.ui', 2], ['server.api', 3]]);
  const relations = [
    { from: 'client', to: 'server', members: [{ from: 'client', to: 'server', type: 'calls' }] },
    { from: 'server', to: 'client', members: [{ from: 'server.api', to: 'client.ui', type: 'returns' }] }
  ];
  const draw = (edges: typeof relations) => simpleMapLines(edges, () => false,
    (edge) => edge.members.length, (edge) => Math.min(...edge.members.map((member) => relationLevel(member, levels))));
  expect(draw(relations)).toMatchObject([{ level: 1, count: 2, twoWay: true }]);
  const [deep] = draw(filterMapRelations(relations, (member) => member.type !== 'calls'));
  expect(deep).toMatchObject({ from: 'server', to: 'client', level: 3, count: 1, twoWay: false });
  expect(mapLinkAppearance(deep?.level, false).width).toBeLessThan(mapLinkAppearance(1, true).width);
  expect(mapLinkAppearance(deep?.level, false).opacity).toBeLessThan(mapLinkAppearance(1, true).opacity);
});

it('allows old isolated nodes but rejects new isolated nodes and self-links', () => {
  const picture = emptyProjectMap();
  picture.domain.nodes = [{ id: 'legacy' }];
  expect(lintMapConnectivity(picture, { domain: { added: { nodes: [{ id: 'new' }], edges: [{ from: 'new', to: 'new', type: 'relates' }] } } }))
    .toMatchObject([{ target: 'node:new', severity: 'error' }]);
  expect(lintMapConnectivity(picture, { domain: { added: { nodes: [{ id: 'new', parent: 'legacy' }] } } })).toEqual([]);
});

it('keeps unrelated cards and sibling frames outside a group while enclosing nested members', () => {
  const standard = standardFor('sysdesign')!.standard;
  const data = [
    { id: 'client' }, { id: 'server' }, { id: 'nested', parent: 'client' },
    { id: 'page', parent: 'client' }, { id: 'control', parent: 'nested' },
    { id: 'endpoint', parent: 'server' }, { id: 'external', parent: 'client' }
  ];
  const external = new Set(['external']);
  const nodes = spaceMapGroups(data, data.map((item) => flowNode(item, standard, 'light')), external);
  const frames = new Map(mapFrames(data, nodes, external).map((frame) => [frame.id, frame]));
  const bounds = (id: string) => {
    const { x, y } = nodes.find((node) => node.id === id)!.position;
    return { left: x, top: y, right: x + NODE_WIDTH, bottom: y + NODE_HEIGHT };
  };
  const overlaps = (a: ReturnType<typeof bounds>, b: ReturnType<typeof bounds>) =>
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const contains = (a: ReturnType<typeof bounds>, b: ReturnType<typeof bounds>) =>
    a.left < b.left && a.top < b.top && a.right > b.right && a.bottom > b.bottom;
  const client = frames.get('client')!;
  const server = frames.get('server')!;
  const nested = frames.get('nested')!;
  expect(contains(client, nested)).toBe(true);
  expect(contains(client, bounds('page'))).toBe(true);
  expect(contains(nested, bounds('control'))).toBe(true);
  expect(contains(server, bounds('endpoint'))).toBe(true);
  expect(overlaps(client, server)).toBe(false);
  expect(overlaps(nested, bounds('page'))).toBe(false);
  for (const frame of [client, server, nested]) expect(overlaps(frame, bounds('external'))).toBe(false);
  expect(overlaps(client, bounds('client'))).toBe(false);
  expect(overlaps(server, bounds('server'))).toBe(false);
});

it('compacts unused space inside a frame while leaving distant neighbors in place', () => {
  const standard = standardFor('sysdesign')!.standard;
  const data = [{ id: 'group' }, { id: 'a', parent: 'group' }, { id: 'b', parent: 'group' }, { id: 'neighbor' }];
  const visible = data.slice(1).map((item, i) => ({
    ...flowNode(item, standard, 'light'), position: { x: 0, y: i * 600 }
  }));
  const placed = new Map(spaceMapGroups(data, visible, new Set()).map((node) => [node.id, node.position]));
  const gap = placed.get('b')!.y - placed.get('a')!.y - NODE_HEIGHT;
  expect(gap).toBeGreaterThan(0);
  expect(gap).toBeLessThan(50);
  expect(placed.get('neighbor')).toEqual(visible[2]!.position);
});

it('moves only descendants and detects a frame overlapping an external card', () => {
  const standard = standardFor('sysdesign')!.standard;
  const data = [{ id: 'group' }, { id: 'nested', parent: 'group' }, { id: 'card', parent: 'nested' }, { id: 'outside', parent: 'group' }];
  const external = new Set(['outside']);
  const card = flowNode(data[2]!, standard, 'light');
  const neighbor = { ...flowNode(data[3]!, standard, 'light'), position: { x: 400, y: 0 } };
  expect([...frameMembers(data, 'group', external)]).toEqual(['nested', 'card']);
  expect(frameCollision(data, [card, neighbor], external)).toBe(false);
  const moved = { ...card, position: { x: 200, y: 0 } };
  expect(frameCollision(data, [moved, neighbor], external)).toBe(true);
  const links = simpleMapLines([{ from: 'group', to: 'outside' }, { from: 'card', to: 'outside' }], () => false, () => 1);
  const svg = mapSvg([card, neighbor], links, mapFrames(data, [card, neighbor], external), standard, false);
  expect(svg).toContain('stroke-width="3" stroke-opacity="1"');
  expect(svg).toContain('stroke-width="1" stroke-opacity="0.65"');
});

it('balances a tall overview toward a wide desktop aspect while keeping groups separate', () => {
  const standard = standardFor('sysdesign')!.standard;
  const groups = ['a', 'b', 'c', 'd'];
  const children = groups.map((parent) => ({ id: parent + '.item', parent }));
  const all = [...groups.map((id) => ({ id })), ...children];
  const original = children.map((node, index) => ({
    ...flowNode(node, standard, 'light'), position: { x: 0, y: index * 400 }
  }));
  const arranged = spaceMapGroups(all, original, new Set());
  const frames = mapFrames(all, arranged, new Set());
  const width = Math.max(...frames.map((frame) => frame.right)) - Math.min(...frames.map((frame) => frame.left));
  const height = Math.max(...frames.map((frame) => frame.bottom)) - Math.min(...frames.map((frame) => frame.top));
  expect(width / height).toBeGreaterThan(1.5);
  expect(width / height).toBeLessThan(2.4);
  expect(frameCollision(all, arranged, new Set())).toBe(false);
});

it('compacts only the selected frame and preserves its corner and external positions', () => {
  const standard = standardFor('sysdesign')!.standard;
  const data = [{ id: 'group' }, { id: 'a', parent: 'group' }, { id: 'b', parent: 'group' }, { id: 'neighbor' }];
  const nodes = data.slice(1).map((node, i) => ({
    ...flowNode(node, standard, 'light'), position: { x: i * 600, y: i * 200 }
  }));
  const packed = compactMapFrame(data, nodes, new Set(), [], 'group');
  expect(packed[0]?.position).toEqual(nodes[0]?.position);
  expect(packed[1]!.position.x).toBeLessThan(nodes[1]!.position.x);
  expect(packed[2]).toBe(nodes[2]);
});

it('reflows staggered cards into an aligned column even when their horizontal ranges overlap', () => {
  const standard = standardFor('sysdesign')!.standard;
  const children = ['a', 'b', 'c', 'd'].map((id) => ({ id, parent: 'group' }));
  const data = [{ id: 'group' }, ...children];
  const nodes = children.map((child, i) => ({
    ...flowNode(child, standard, 'light'), position: { x: i * 70, y: i * 100 }
  }));
  const packed = compactMapFrame(data, nodes, new Set(), [], 'group');
  expect(packed.map((node) => node.position.x)).toEqual([0, 0, 0, 0]);
  expect(packed.map((node) => node.position.y)).toEqual([0, 98, 196, 294]);
});
