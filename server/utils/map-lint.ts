import { customDefinitions } from '../lib/custom-maps';
import { lintDomainChange, lintCustomChange, lintStrategicChange, overridesFrom, standardFor, type LintFinding } from '../lib/map-core';
import type { MapChange } from '../lib/maps';
import { readWorkspace } from '../lib/workspace';
import { buildProjectMap } from './map-service';

/**
 * Линтер на пути записи карты (R-0141): черновик с ошибкой не пишется, ответ — 422 `map_lint`
 * с узлом, полем и строкой. Переопределения стандарта — из `maps.standards` манифеста.
 */
export function lintMapChange(root: string, change: MapChange, text?: string): LintFinding[] {
  if (!change.functional && !change.custom && !change.domain) return [];
  const manifest = readWorkspace(root).manifest;
  const picture = buildProjectMap(root);
  const found: LintFinding[] = [];
  if (change.functional) {
    const standard = standardFor('strategic', overridesFrom(manifest.maps?.['standards']))?.standard;
    if (standard) found.push(...lintStrategicChange(change.functional, picture.functional, standard, text));
  }
  if (change.domain) {
    const standard = standardFor('domain', overridesFrom(manifest.maps?.['standards']))?.standard;
    if (standard) found.push(...lintDomainChange(change.domain, picture.domain, standard, text));
  }
  if (change.custom) found.push(...lintCustomChange(change.custom, customDefinitions(manifest).definitions, picture.custom, text));
  return found;
}

/** Детали отказа: каждая находка — своей строкой с кодом, как у отказа схемы. */
export const lintDetails = (findings: readonly LintFinding[]) =>
  findings.filter((item) => item.severity === 'error').map((item) => ({
    code: item.code,
    message: `${item.line ? `строка ${item.line}: ` : ''}${item.message}`,
    target: item.target,
    field: item.field
  }));
