import { analyze } from '../lib/analyze';
import {
  checkEvidence,
  evidenceClaims,
  foldMaps,
  parseMapRecord,
  type EvidenceVerdict,
  type MapChange,
  type ProjectMap
} from '../lib/maps';
import { readWorkspace, sourceReader } from '../lib/workspace';

/**
 * Общая картина проекта: подтверждённые карты, сложенные в порядке
 * подтверждения (docs/07-maps.md). Производное — считается заново и нигде не
 * хранится.
 */

export interface ProjectMapResult extends ProjectMap {
  /** Сколько утверждений не прошло сверку свидетельств. */
  unverified: number;
}

export function buildProjectMap(root: string): ProjectMapResult {
  const workspace = readWorkspace(root);
  const result = analyze({
    files: workspace.files,
    manifest: workspace.manifest,
    reports: workspace.reports,
    codeFiles: workspace.codeFiles
  });
  const read = sourceReader(root);

  const approved = result.records
    .filter((record) => record.type === 'map' && record.status === 'approved' && record.id)
    // Порядок подтверждения известен только по дате правки; при равенстве —
    // по идентификатору, чтобы картина не зависела от обхода папки.
    .sort((a, b) => String(a.data['updated'] ?? '').localeCompare(String(b.data['updated'] ?? ''))
      || a.id.localeCompare(b.id));

  const changes: { id: string; change: MapChange }[] = [];
  let unverified = 0;

  for (const record of approved) {
    const parsed = parseMapRecord(record.body);
    changes.push({ id: record.id, change: parsed.change });

    for (const claim of evidenceClaims(parsed.change)) {
      const verdict: EvidenceVerdict = checkEvidence(claim.evidence, read(claim.evidence.path), claim.side);
      if (verdict !== 'ok') unverified += 1;
    }
  }

  return { ...foldMaps(changes), unverified };
}
