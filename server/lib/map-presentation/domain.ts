import { parseMapRecord, type MapStructure } from '../maps';

const BUILTIN_MAPS = new Set(['domain', 'sysdesign', 'strategy', 'codemap', 'dataflow', 'userflow', 'research']);
const HISTORY_LIMIT = 100;

export type MapPositions = Record<string, { x: number; y: number }>;
export type MapHistoryEntry =
  | { at: string; accountId: string; kind: 'layout' }
  | { at: string; accountId: string; kind: 'structure'; recordId: string };

export interface MapPresentation {
  revision: number;
  views: Record<string, MapPositions>;
  history: MapHistoryEntry[];
}

export interface LayoutPublication {
  map: string;
  view: string;
  revision: number;
  positions: MapPositions;
}

export function isPresentationMap(value: unknown): value is string {
  return typeof value === 'string' && (BUILTIN_MAPS.has(value) || /^custom:[A-Za-z0-9-]+$/.test(value));
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseLayoutPublication(body: unknown): LayoutPublication | undefined {
  if (!object(body)) return;
  const { map, view, revision, positions } = body;
  if (!isPresentationMap(map) || typeof view !== 'string' || !view.trim() ||
      typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0 || !object(positions)) return;
  const entries = [];
  for (const [id, point] of Object.entries(positions)) {
    if (!id.trim() || !object(point) || typeof point.x !== 'number' || typeof point.y !== 'number' ||
        !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    entries.push([id, { x: point.x, y: point.y }] as const);
  }
  return { map, view, revision, positions: Object.fromEntries(entries) };
}

export function withHistory(current: MapPresentation, entry: MapHistoryEntry): MapPresentation {
  return { ...current, history: [entry, ...current.history].slice(0, HISTORY_LIMIT) };
}

const STRUCTURE_MAPS: Partial<Record<MapStructure, string>> = {
  functional: 'strategy', codemap: 'codemap', dataflow: 'dataflow', userflow: 'userflow',
  domain: 'domain', sysdesign: 'sysdesign'
};

export function mapKeysForChange(text: string): string[] {
  const { change, present } = parseMapRecord(text);
  const keys = new Set<string>();
  for (const kind of present) {
    const map = STRUCTURE_MAPS[kind];
    if (map && change[kind]) keys.add(map);
  }
  for (const part of [change.custom?.added, change.custom?.removed]) {
    for (const item of [...(part?.nodes ?? []), ...(part?.relations ?? [])]) {
      const key = `custom:${item.map}`;
      if (isPresentationMap(key)) keys.add(key);
    }
  }
  return [...keys];
}
