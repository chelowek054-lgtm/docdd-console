import { analyze } from '../lib/analyze';
import { withBuiltin } from '../lib/builtin';
import { plainTokens, resolveDesign, type DesignRecord } from '../lib/design';
import { designDiff, type DesignDiff } from '../lib/design-diff';
import { normalizeRoot } from '../lib/paths';
import { readManifest, readWorkspace } from '../lib/workspace';
import { generalRuleRecords } from './rules-service';

/**
 * Разница токенов записи дизайна (R-0073): «было» — подтверждённые записи без неё,
 * «станет» — вместе с ней, в любом статусе. Сборка входа та же, что у `projectDesign`.
 */
export function designDiffForRecord(root: string, recordId: string): DesignDiff | null {
  const normalized = normalizeRoot(root);
  const manifest = readManifest(normalized);
  const workspace = readWorkspace(normalized);
  const { records } = analyze({ files: workspace.files, manifest });
  const isDesign = (type: string) => type === 'decision' || type === 'design';
  const target = records.find((record) => record.id === recordId && isDesign(record.type));
  if (!target) return null;

  const toDesign = (record: { id: string; body: string }): DesignRecord => ({ id: record.id, body: record.body });
  const others = records
    .filter((record) => isDesign(record.type) && record.status === 'approved' && record.id !== recordId)
    .map(toDesign);
  const general = generalRuleRecords(withBuiltin(manifest.sources?.shared ?? []));
  const before = plainTokens(resolveDesign({ general, local: others }).tokens);
  const after = plainTokens(resolveDesign({ general, local: [...others, toDesign(target)] }).tokens);
  return designDiff(before, after, manifest.design?.stacks ?? []);
}
