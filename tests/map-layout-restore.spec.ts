import { expect, it } from 'vitest';
import { restoreMapPositions } from '../app/utils/map-layout-restore';
import { frameCollision } from '../app/utils/map-presentation';
import { flowNode } from '../app/utils/map-flow';
import { standardFor } from '../server/lib/map-core';

it('keeps published node positions and fits a new descendant near its group', () => {
  const standard = standardFor('domain')!.standard;
  const hierarchy = [
    { id: 'group' }, { id: 'saved', parent: 'group' }, { id: 'new', parent: 'group' }, { id: 'neighbor' }
  ];
  const nodes = hierarchy.slice(1).map((item) => flowNode(item, standard, 'light'));
  const positions = { saved: { x: 80, y: 20 }, neighbor: { x: 400, y: 20 } };
  const placed = restoreMapPositions(nodes, positions, hierarchy, new Set());
  expect(placed[0]?.position).toEqual(positions.saved);
  expect(placed[1]?.position.x).toBeLessThan(positions.neighbor.x);
  expect(placed[1]?.position.y).toBeGreaterThan(100);
  expect(placed[2]?.position).toEqual(positions.neighbor);
  expect(frameCollision(hierarchy, placed, new Set())).toBe(false);
});
