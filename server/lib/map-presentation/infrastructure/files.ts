import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { resolveInside } from '../../paths';
import { DEVELOPMENT_DIR } from '../../workspace';
import { isPresentationMap, mapKeysForChange, withHistory, type LayoutPublication, type MapPresentation } from '../domain';

function presentationPath(root: string, map: string): string {
  if (!isPresentationMap(map)) throw new TypeError('Неизвестная карта');
  const key = map.startsWith('custom:') ? `custom-${createHash('sha256').update(map).digest('hex')}` : map;
  return resolveInside(root, `${DEVELOPMENT_DIR}/maps/presentation/${key}.json`);
}

function read(file: string): MapPresentation {
  try {
    const state = JSON.parse(readFileSync(file, 'utf8')) as MapPresentation | null;
    if (!state || !Number.isSafeInteger(state.revision) || state.revision < 0 ||
        !state.views || typeof state.views !== 'object' || Array.isArray(state.views) || !Array.isArray(state.history)) {
      throw new Error('Неверный формат сохранённой раскладки');
    }
    return state;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { revision: 0, views: {}, history: [] };
    throw error;
  }
}

function write(file: string, state: MapPresentation): void {
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify(state, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
    renameSync(temporary, file);
  } finally {
    rmSync(temporary, { force: true });
  }
}

export function loadMapPresentation(root: string, map: string): MapPresentation {
  return read(presentationPath(root, map));
}

export function publishMapLayout(root: string, publication: LayoutPublication, accountId: string, now = new Date()): MapPresentation | null {
  const file = presentationPath(root, publication.map);
  // Read, revision check, and atomic replacement share one synchronous transaction in the server.
  const current = read(file);
  if (publication.revision !== current.revision) return null;
  const state = withHistory({
    ...current,
    revision: current.revision + 1,
    views: { ...current.views, [publication.view]: publication.positions }
  }, { at: now.toISOString(), accountId, kind: 'layout' });
  write(file, state);
  return state;
}

export function recordMapApproval(root: string, recordId: string, text: string, accountId: string, now = new Date()): string[] {
  const missed: string[] = [];
  for (const map of mapKeysForChange(text)) {
    try {
      const file = presentationPath(root, map);
      const current = read(file);
      write(file, withHistory(current, { at: now.toISOString(), accountId, kind: 'structure', recordId }));
    } catch (error) {
      console.error(`DocDD: не записана история карты ${map} для записи ${recordId}`, error);
      missed.push(map);
    }
  }
  return missed;
}
