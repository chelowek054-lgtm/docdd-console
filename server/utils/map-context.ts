import { mapContextFor, mapContextMatches, normalizeMapContextId, type MapContextOptions } from '../lib/map-context';
import { normalizeRoot } from '../lib/paths';
import { readManifest } from '../lib/workspace';
import { inventoryOf } from './inventory-service';
import { buildProjectMap } from './map-service';

export { targetsOfMapChange } from '../lib/map-context';

function contextReader(projectRoot: string, projectId: string) {
  const root = normalizeRoot(projectRoot);
  const manifest = readManifest(root);
  const project = buildProjectMap(root);
  return (map: string, options?: MapContextOptions) =>
    mapContextFor(root, projectId, map, manifest, project, map === 'codemap' ? inventoryOf(root) : undefined, options);
}

export function buildMapContext(root: string, projectId: string, requested: string, options?: MapContextOptions) {
  const map = normalizeMapContextId(requested);
  if (map) return contextReader(root, projectId)(map, options);
}

export function missingMapContexts(root: string, projectId: string, maps: readonly string[], supplied: unknown) {
  const tokens = Array.isArray(supplied) ? supplied : [];
  if (!maps.length || !tokens.length) return [...maps];
  const read = contextReader(root, projectId);
  return maps.filter((map) => {
    const context = read(map);
    return !context || !mapContextMatches(context.contextToken, tokens);
  });
}
