import { defineEventHandler, getRouterParam } from 'h3';
import { researchHistory, stageMeasurements, verificationRuns } from '../../../../lib/industry-maps';
import { parseRecord } from '../../../../lib/parse';
import { readWorkspace } from '../../../../lib/workspace';
import { fail } from '../../../../utils/http';
import { buildProjectMap } from '../../../../utils/map-service';
import { fingerprintProject, memoByFingerprint } from '../../../../utils/memo';
import { findProject } from '../../../../utils/projects';

export default defineEventHandler(async (event) => {
  const project = await findProject(getRouterParam(event, 'id') ?? '');
  if (!project) return fail(event, 404, 'project_not_found', 'Проект не найден');
  const workspace = readWorkspace(project.root);
  const picture = memoByFingerprint(project.root, 'map', () => fingerprintProject(project.root), () => buildProjectMap(project.root));
  const decisions = researchHistory(workspace.files.filter((file) => file.source.section === 'decisions').flatMap((file) => {
    const result = parseRecord(file.text, file.source);
    return result.ok ? [result.record] : [];
  }));
  return {
    decisions: decisions.map((item) => ({ ...item, runs: verificationRuns(item.verifications, workspace.reports) })),
    current: picture.codemap.modules.flatMap((node) => node.ml ? [{ id: node.id, title: node.title ?? node.id, stage: node.ml, runs: stageMeasurements(node.ml, workspace.reports) }] : []),
    target: picture.sysdesign.nodes.flatMap((node) => node.ml ? [{ id: node.id, title: node.title, stage: node.ml, runs: stageMeasurements(node.ml, workspace.reports) }] : [])
  };
});
