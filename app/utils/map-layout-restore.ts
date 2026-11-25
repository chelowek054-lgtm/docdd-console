import { NODE_HEIGHT, NODE_WIDTH, type FlowCapability, type FlowNode } from './map-flow';
import { frameCollision, mapFrames } from './map-presentation';

export type MapPosition = FlowNode['position'];
export type MapPositions = Record<string, MapPosition>;

export function restoreMapPositions(
  nodes: FlowNode[], positions: MapPositions, hierarchy: FlowCapability[], external: ReadonlySet<string>
) {
  const result = new Map<string, FlowNode>();
  for (const node of nodes) {
    const position = Object.hasOwn(positions, node.id) ? positions[node.id] : undefined;
    if (position) result.set(node.id, { ...node, position });
  }
  const parents = new Map(hierarchy.map((node) => [node.id, node.parent]));
  const gap = 24;
  for (const node of nodes) {
    if (result.has(node.id)) continue;
    const placed = [...result.values()];
    const parent = external.has(node.id) ? undefined : parents.get(node.id);
    const frame = parent ? mapFrames(hierarchy, placed, external).find((box) => box.id === parent) : undefined;
    const { x, y } = node.position;
    const right = Math.max(x, ...placed.map((item) => item.position.x + NODE_WIDTH));
    const bottom = Math.max(y, ...placed.map((item) => item.position.y + NODE_HEIGHT));
    const candidates = [
      ...(frame ? [
        { x: frame.left + gap, y: frame.bottom + gap },
        { x: frame.right + gap, y: frame.top + gap },
        { x: frame.left - NODE_WIDTH - gap, y: frame.top + gap },
        { x: frame.left + gap, y: frame.top - NODE_HEIGHT - gap }
      ] : []),
      node.position, { x: right + gap, y }, { x, y: bottom + gap }
    ];
    const fits = (candidate: MapPosition) => placed.every(({ position: other }) =>
      candidate.x + NODE_WIDTH + gap <= other.x || other.x + NODE_WIDTH + gap <= candidate.x ||
      candidate.y + NODE_HEIGHT + gap <= other.y || other.y + NODE_HEIGHT + gap <= candidate.y
    ) && !frameCollision(hierarchy, [...placed, { ...node, position: candidate }], external);
    let position = candidates.find(fits);
    if (!position && frame) {
      for (const other of placed) {
        if (other.position.x < frame.left || other.position.x + NODE_WIDTH > frame.right ||
            other.position.y < frame.top || other.position.y + NODE_HEIGHT > frame.bottom) continue;
        position = [
          { x: other.position.x + NODE_WIDTH + gap, y: other.position.y },
          { x: other.position.x, y: other.position.y + NODE_HEIGHT + gap }
        ].find(fits);
        if (position) break;
      }
    }
    result.set(node.id, { ...node, position: position ?? { x: right + gap, y } });
  }
  return nodes.map((node) => result.get(node.id)!);
}
