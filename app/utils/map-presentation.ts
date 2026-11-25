import { NODE_HEIGHT, NODE_WIDTH, type FlowCapability, type FlowNode, type FlowRelation } from './map-flow';
import { MAP_SHAPES } from './map-shapes';
import type { MapStandard } from '../../server/lib/map-core';

export interface VisibleLine<T> {
  id: string;
  from: string;
  to: string;
  twoWay: boolean;
  members: T[];
  count: number;
  level?: number;
}

export function simpleMapLines<T extends { from: string; to: string }>(
  edges: T[], twoWay: (edge: T) => boolean, size: (edge: T) => number, levelOf?: (edge: T) => number
): VisibleLine<T>[] {
  const lines = new Map<string, VisibleLine<T>>();
  for (const edge of edges) {
    if (edge.from === edge.to) continue;
    const id = JSON.stringify([edge.from, edge.to].sort());
    const line = lines.get(id) ?? { id, from: edge.from, to: edge.to, twoWay: false, members: [], count: 0 };
    line.twoWay ||= line.from !== edge.from || twoWay(edge);
    line.members.push(edge);
    line.count += size(edge);
    if (levelOf) line.level = Math.min(line.level ?? Infinity, levelOf(edge));
    lines.set(id, line);
  }
  return [...lines.values()];
}

export function relationLevel(edge: FlowRelation, depths: ReadonlyMap<string, number>) {
  return Math.max(depths.get(edge.from) ?? 1, depths.get(edge.to) ?? 1);
}

export function filterMapRelations<T extends { members: FlowRelation[] }>(edges: T[], visible: (edge: FlowRelation) => boolean) {
  return edges.flatMap((edge) => {
    const members = edge.members.filter(visible);
    return members.length ? [{ ...edge, members }] : [];
  });
}

export function mapLinkAppearance(level: number | undefined, isFrame: boolean) {
  if (level === undefined) return { width: isFrame ? GROUP_LINK_WIDTH : 1, opacity: isFrame ? 1 : 0.65 };
  return {
    width: 1 + 2 * 0.54 ** (level - 1),
    opacity: 0.65 + 0.35 * 0.59 ** (level - 1)
  };
}

const FRAME_PADDING = 12;
const FRAME_HEADER = 16;
const ITEM_GAP = 14;

export function spaceMapGroups(all: FlowCapability[], visible: FlowNode[], external: ReadonlySet<string>,
  links: readonly { from: string; to: string }[] = [], balanceOverview = true, compactGaps = { x: 32, y: 20 }) {
  const parents = new Map(all.map((node) => [node.id, node.parent]));
  type Block = { nodes: FlowNode[]; left: number; right: number; top: number; bottom: number };
  type Branch = { blocks: Block[]; children: Map<string, Branch> };
  const root: Branch = { blocks: [], children: new Map() };
  if (!visible.some((node) => !external.has(node.id) && parents.get(node.id))) return visible;
  for (const node of visible) {
    const path: string[] = [];
    const seen = new Set([node.id]);
    for (let id = external.has(node.id) ? undefined : parents.get(node.id); id && !seen.has(id); id = parents.get(id)) {
      seen.add(id);
      path.unshift(id);
    }
    let branch: Branch = root;
    for (const id of path) {
      const child = branch.children.get(id) ?? { blocks: [], children: new Map<string, Branch>() };
      branch.children.set(id, child);
      branch = child;
    }
    const { x, y } = node.position;
    branch.blocks.push({ nodes: [node], left: x, right: x + NODE_WIDTH, top: y, bottom: y + NODE_HEIGHT });
  }
  function move(block: Block, dx: number, dy: number): Block {
    return {
      left: block.left + dx, right: block.right + dx, top: block.top + dy, bottom: block.bottom + dy,
      nodes: block.nodes.map((node) => ({
        ...node, position: { x: node.position.x + dx, y: node.position.y + dy }
      }))
    };
  }
  function compact(blocks: Block[], axis: 'x' | 'y', maxGap: number) {
    const [start, end] = axis === 'x' ? ['left', 'right'] as const : ['top', 'bottom'] as const;
    let previousEnd = -Infinity;
    let removed = 0;
    return blocks.sort((a, b) => a[start] - b[start]).map((block) => {
      if (Number.isFinite(previousEnd)) removed += Math.max(0, block[start] - previousEnd - maxGap);
      previousEnd = Math.max(previousEnd, block[end]);
      return axis === 'x' ? move(block, -removed, 0) : move(block, 0, -removed);
    });
  }
  function clearance(block: Block, neighbors: Block[], axis: 'x' | 'y') {
    const [start, end, crossStart, crossEnd] = axis === 'x'
      ? ['left', 'right', 'top', 'bottom'] as const
      : ['top', 'bottom', 'left', 'right'] as const;
    let offset = 0;
    for (const other of [...neighbors].sort((a, b) => a[start] - b[start])) {
      if (block[crossStart] >= other[crossEnd] + ITEM_GAP || block[crossEnd] <= other[crossStart] - ITEM_GAP) continue;
      if (block[start] + offset < other[end] + ITEM_GAP && block[end] + offset > other[start] - ITEM_GAP) {
        offset = other[end] + ITEM_GAP - block[start];
      }
    }
    return offset;
  }
  function pack(branch: Branch, framed: boolean): Block {
    const items = [...branch.blocks, ...[...branch.children.values()].map((child) => pack(child, true))];
    function enclose(placed: Block[]) {
      const padding = framed ? FRAME_PADDING : 0;
      return {
        nodes: placed.flatMap((block) => block.nodes),
        left: Math.min(...placed.map((block) => block.left)) - padding,
        right: Math.max(...placed.map((block) => block.right)) + padding,
        top: Math.min(...placed.map((block) => block.top)) - padding - (framed ? FRAME_HEADER : 0),
        bottom: Math.max(...placed.map((block) => block.bottom)) + padding
      };
    }
    function place(blocks: Block[]) {
      const placed: Block[] = [];
      for (const block of blocks.sort((a, b) => a.top - b.top || a.left - b.left)) {
        const dx = clearance(block, placed, 'x');
        const dy = clearance(block, placed, 'y');
        placed.push(dx < dy ? move(block, dx, 0) : move(block, 0, dy));
      }
      return enclose(placed);
    }
    const base = place([...items]);
    if (!framed && balanceOverview && branch.children.size >= 2 && items.length >= 3) {
      const ratio = 16 / 9;
      const gap = 48;
      const ordered = [...items].sort((a, b) => a.left - b.left || a.top - b.top);
      const area = ordered.reduce((sum, block) =>
        sum + (block.right - block.left + gap) * (block.bottom - block.top + gap), 0);
      const nominalWidth = Math.sqrt(area * ratio);
      const widest = Math.max(...ordered.map((block) => block.right - block.left));
      function rows(maxWidth: number) {
        let x = 0, y = 0, rowHeight = 0;
        return enclose(ordered.map((block) => {
          const width = block.right - block.left;
          if (x && x + width > maxWidth) {
            x = 0;
            y += rowHeight + gap;
            rowHeight = 0;
          }
          const next = move(block, base.left + x - block.left, base.top + y - block.top);
          rowHeight = Math.max(rowHeight, block.bottom - block.top);
          x += width + gap;
          return next;
        }));
      }
      const score = (block: Block) => {
        const width = block.right - block.left, height = block.bottom - block.top;
        return Math.max(width / ratio, height) + Math.sqrt(width * height / ratio) * 0.2;
      };
      const choices = [place(compact(compact([...items], 'x', gap), 'y', gap)),
        ...[0.85, 1, 1.2, 1.4].map((factor) => rows(Math.max(widest, nominalWidth * factor)))];
      return choices.reduce((best, candidate) => score(candidate) < score(best) ? candidate : best, base);
    }
    if (!framed || items.length < 2) return base;
    const tight = place(compact(compact(items, 'x', compactGaps.x), 'y', compactGaps.y));
    const area = (block: Block) => (block.right - block.left) * (block.bottom - block.top);
    if (area(tight) >= area(base)) return base;
    const segments = (block: Block) => {
      const byId = new Map(block.nodes.map((node) => [node.id, node]));
      return links.flatMap(({ from, to }) => {
        const a = byId.get(from), b = byId.get(to);
        return a && b ? [mapLinePorts(a, b)] : [];
      });
    };
    const before = segments(base), after = segments(tight);
    return after.every((line, i) => line.sourceHandle === before[i]?.sourceHandle) &&
      crossingCount(after) <= crossingCount(before) ? tight : base;
  }
  return pack(root, false).nodes;
}

function crossingCount(lines: ReturnType<typeof mapLinePorts>[]) {
  const side = (a: ReturnType<typeof mapLinePorts>, x: number, y: number) =>
    (a.x2 - a.x1) * (y - a.y1) - (a.y2 - a.y1) * (x - a.x1);
  let count = 0;
  for (const [i, a] of lines.entries()) {
    for (let j = i + 1; j < lines.length; j++) {
      const b = lines[j]!;
      if (side(a, b.x1, b.y1) * side(a, b.x2, b.y2) < 0 &&
        side(b, a.x1, a.y1) * side(b, a.x2, a.y2) < 0) count++;
    }
  }
  return count;
}

export function frameMembers(all: FlowCapability[], id: string, external: ReadonlySet<string>) {
  const parents = new Map(all.map((node) => [node.id, node.parent]));
  return new Set(all.filter((node) => {
    if (external.has(node.id)) return false;
    const seen = new Set([node.id]);
    for (let parent = node.parent; parent && !seen.has(parent); parent = parents.get(parent)) {
      if (parent === id) return true;
      seen.add(parent);
    }
    return false;
  }).map((node) => node.id));
}

export function frameCollision(all: FlowCapability[], nodes: FlowNode[], external: ReadonlySet<string>) {
  const frames = mapFrames(all, nodes, external);
  const membersByFrame = new Map(frames.map((frame) => [frame.id, frameMembers(all, frame.id, external)]));
  const bounds = nodes.map(({ id, position: { x, y } }) => ({
    id, left: x, top: y, right: x + NODE_WIDTH, bottom: y + NODE_HEIGHT
  }));
  return frames.some((frame) => {
    const members = membersByFrame.get(frame.id);
    return [...frames, ...bounds].some((box) => box.id !== frame.id && !members?.has(box.id) &&
      !membersByFrame.get(box.id)?.has(frame.id) &&
      frame.left < box.right && frame.right > box.left && frame.top < box.bottom && frame.bottom > box.top);
  });
}

export function compactMapFrame(all: FlowCapability[], nodes: FlowNode[], external: ReadonlySet<string>,
  links: readonly { from: string; to: string }[], id: string) {
  const frames = mapFrames(all, nodes, external);
  const frame = frames.find((box) => box.id === id);
  if (!frame) return nodes;
  const members = frameMembers(all, id, external);
  const subtree = [{ id, title: frame.title }, ...all.filter((node) => members.has(node.id))];
  const inside = nodes.filter((node) => members.has(node.id));
  const choices = [spaceMapGroups(subtree, inside, external, links, false, { x: 20, y: ITEM_GAP })];
  const blocks = all.filter((node) => node.parent === id && members.has(node.id)).flatMap((node) => {
    const box = frames.find((item) => item.id === node.id);
    const card = inside.find((item) => item.id === node.id);
    if (box) {
      const descendants = frameMembers(all, node.id, external);
      return [{ ...box, nodes: inside.filter((item) => descendants.has(item.id)) }];
    }
    if (!card) return [];
    const { x, y } = card.position;
    return [{ id: node.id, title: node.title ?? node.id, left: x, top: y,
      right: x + NODE_WIDTH, bottom: y + NODE_HEIGHT, nodes: [card] }];
  });
  if (blocks.length >= 2) {
    const byRow = [...blocks].sort((a, b) => a.top - b.top || a.left - b.left);
    const byColumn = [...blocks].sort((a, b) => a.left - b.left || a.top - b.top);
    const gridWidths = new Set([1, Math.ceil(Math.sqrt(blocks.length)), blocks.length]);
    for (const columns of gridWidths) {
      for (const order of [byRow, byColumn]) {
        const widths = Array.from({ length: columns }, (_, column) =>
          Math.max(...order.filter((_, i) => i % columns === column).map((box) => box.right - box.left)));
        let y = 0;
        const aligned: FlowNode[] = [];
        for (let index = 0; index < order.length; index += columns) {
          const row = order.slice(index, index + columns);
          let x = 0;
          for (const [column, box] of row.entries()) {
            aligned.push(...box.nodes.map((node) => ({
              ...node, position: { x: node.position.x + x - box.left, y: node.position.y + y - box.top }
            })));
            x += widths[column]! + ITEM_GAP;
          }
          y += Math.max(...row.map((box) => box.bottom - box.top)) + ITEM_GAP;
        }
        if (aligned.length === inside.length) choices.push(aligned);
      }
    }
  }
  const area = (box: typeof frame) => (box.right - box.left) * (box.bottom - box.top);
  function readability(cards: FlowNode[]) {
    const endpoints = new Map([...cards, ...mapFrames(all, cards, external).map(frameEndpoint)].map((node) => [node.id, node]));
    const segments = links.flatMap((link) => {
      const a = endpoints.get(link.from), b = endpoints.get(link.to);
      return a && b ? [{ ...mapLinePorts(a, b), from: link.from, to: link.to }] : [];
    });
    let obstructions = 0;
    for (const line of segments) {
      const movedEnd = members.has(line.from) || members.has(line.to) || line.from === id || line.to === id;
      for (const card of cards) {
        if ((movedEnd || members.has(card.id)) && card.id !== line.from && card.id !== line.to &&
            lineHitsCard(line, card)) obstructions++;
      }
    }
    return { crossings: crossingCount(segments), obstructions };
  }
  const baseline = readability(nodes);
  let bestArea = area(frame);
  let best = nodes;
  for (const compacted of choices) {
    const nextFrame = mapFrames(subtree, compacted, external).find((box) => box.id === id);
    if (!nextFrame || area(nextFrame) >= bestArea) continue;
    const byId = new Map(compacted.map((node) => [node.id, node.position]));
    const next = nodes.map((node) => {
      const position = byId.get(node.id);
      return position ? { ...node, position: {
        x: position.x + frame.left - nextFrame.left, y: position.y + frame.top - nextFrame.top
      } } : node;
    });
    if (frameCollision(all, next, external)) continue;
    const score = readability(next);
    if (score.crossings > baseline.crossings || score.obstructions > baseline.obstructions) continue;
    bestArea = area(nextFrame);
    best = next;
  }
  return best;
}

function lineHitsCard(line: ReturnType<typeof mapLinePorts>, card: FlowNode) {
  const { x, y } = card.position;
  const axes = [
    { start: line.x1, end: line.x2, min: x + 1, max: x + NODE_WIDTH - 1 },
    { start: line.y1, end: line.y2, min: y + 1, max: y + NODE_HEIGHT - 1 }
  ];
  let enter = 0, exit = 1;
  for (const { start, end, min, max } of axes) {
    const length = end - start;
    if (!length) {
      if (start < min || start > max) return false;
      continue;
    }
    const a = (min - start) / length, b = (max - start) / length;
    enter = Math.max(enter, Math.min(a, b));
    exit = Math.min(exit, Math.max(a, b));
  }
  return enter < exit;
}

export const GROUP_LINK_WIDTH = 3;

export function mapFrames(all: FlowCapability[], visible: FlowNode[], external: ReadonlySet<string>) {
  const byId = new Map(all.map((node) => [node.id, node]));
  const bounds = new Map<string, { title: string; left: number; top: number; right: number; bottom: number }>();
  for (const node of visible) {
    if (external.has(node.id)) continue;
    const seen = new Set([node.id]);
    let padding = FRAME_PADDING;
    let header = FRAME_HEADER;
    for (let id = byId.get(node.id)?.parent; id && !seen.has(id); id = byId.get(id)?.parent) {
      seen.add(id);
      const other = bounds.get(id);
      const { x, y } = node.position;
      bounds.set(id, {
        title: byId.get(id)?.title ?? id,
        left: Math.min(other?.left ?? Infinity, x - padding),
        top: Math.min(other?.top ?? Infinity, y - padding - header),
        right: Math.max(other?.right ?? -Infinity, x + NODE_WIDTH + padding),
        bottom: Math.max(other?.bottom ?? -Infinity, y + NODE_HEIGHT + padding)
      });
      padding += FRAME_PADDING;
      header += FRAME_HEADER;
    }
  }
  return [...bounds].map(([id, box]) => ({ id, ...box })).reverse();
}

export function mapLinePorts(
  a: { position: FlowNode['position']; width?: number; height?: number },
  b: { position: FlowNode['position']; width?: number; height?: number }
) {
  const aw = a.width ?? NODE_WIDTH, bw = b.width ?? NODE_WIDTH;
  const forward = a.position.x + aw / 2 <= b.position.x + bw / 2;
  return {
    x1: a.position.x + (forward ? aw : 0), y1: a.position.y + (a.height ?? NODE_HEIGHT) / 2,
    x2: b.position.x + (forward ? 0 : bw), y2: b.position.y + (b.height ?? NODE_HEIGHT) / 2,
    sourceHandle: forward ? 'out' : 'out-left', targetHandle: forward ? 'in' : 'in-right'
  };
}

export function frameEndpoint(frame: ReturnType<typeof mapFrames>[number]) {
  return {
    id: frame.id, position: { x: frame.left, y: frame.top },
    width: frame.right - frame.left, height: frame.bottom - frame.top
  };
}

const xml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
}[char] ?? char));

export function mapSvg(nodes: FlowNode[], lines: VisibleLine<unknown>[], frames: ReturnType<typeof mapFrames>, standard: MapStandard, dark: boolean) {
  const byId = new Map([...nodes, ...frames.map(frameEndpoint)].map((node) => [node.id, node]));
  const background = dark ? '#111827' : '#ffffff';
  const foreground = dark ? '#f1f5f9' : '#172033';
  const frameIds = new Set(frames.map((frame) => frame.id));
  const boxes = [...frames, ...nodes.map(({ position: { x, y } }) => ({ left: x, top: y, right: x + NODE_WIDTH, bottom: y + NODE_HEIGHT }))];
  const left = Math.min(0, ...boxes.map((box) => box.left)) - 24;
  const top = Math.min(0, ...boxes.map((box) => box.top)) - 24;
  const width = Math.max(0, ...boxes.map((box) => box.right)) - left + 24;
  const height = Math.max(0, ...boxes.map((box) => box.bottom)) - top + 24;
  const outlines = frames.map((f) => `<rect x="${f.left}" y="${f.top}" width="${f.right-f.left}" height="${f.bottom-f.top}" rx="8" fill="none" stroke="${foreground}" opacity=".5"/><text x="${f.left+8}" y="${f.top+16}">${xml(f.title)}</text>`);
  const connections = lines.flatMap((line) => {
    const a = byId.get(line.from), b = byId.get(line.to);
    if (!a || !b) return [];
    const { x1, y1, x2, y2 } = mapLinePorts(a, b);
    const { width, opacity } = mapLinkAppearance(line.level, frameIds.has(line.from) || frameIds.has(line.to));
    return [`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${foreground}" stroke-width="${width}" stroke-opacity="${opacity}" marker-end="url(#arrow)"${line.twoWay ? ' marker-start="url(#arrow)"' : ''}/>${line.count > 1 ? `<text x="${(x1+x2)/2}" y="${(y1+y2)/2-4}" text-anchor="middle">${line.count}</text>` : ''}`];
  });
  const cards = nodes.map(({ data, position }) => {
    const shape = standard.nodeKinds.find((kind) => kind.id === data.kind)?.shape ?? 'rounded';
    return `<g transform="translate(${position.x} ${position.y})"><svg width="${NODE_WIDTH}" height="${NODE_HEIGHT}" viewBox="0 0 100 60" preserveAspectRatio="none"><path d="${MAP_SHAPES[shape]}" fill="${background}" stroke="${xml(data.color)}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg><text x="16" y="30" fill="${xml(data.color)}">${xml(data.kindTitle.substring(0,32))}</text><text x="16" y="54"><title>${xml(data.title)}</title>${xml(data.title.length > 28 ? data.title.slice(0,27) + '…' : data.title)}</text></g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${top} ${width} ${height}" width="${width}" height="${height}"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse"><path d="M0 0L8 4L0 8Z" fill="${foreground}"/></marker></defs><rect x="${left}" y="${top}" width="${width}" height="${height}" fill="${background}"/><g font-family="system-ui,sans-serif" font-size="13" fill="${foreground}">${[...outlines,...connections,...cards].join('')}</g></svg>`;
}
