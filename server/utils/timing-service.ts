import { analyze } from '../lib/analyze';
import { normalizeRoot } from '../lib/paths';
import { projectTimings, type ProjectTimings } from '../lib/timing';
import { readWorkspace } from '../lib/workspace';

/** Тайминги проекта (ADR-0039): из записей и журналов при чтении, пояс — из манифеста. */
export function timingsOf(root: string, now = new Date()): ProjectTimings {
  const workspace = readWorkspace(normalizeRoot(root));
  const records = analyze({ files: workspace.files, manifest: workspace.manifest }).records;
  return projectTimings(records, now, workspace.manifest.project?.timezone);
}
