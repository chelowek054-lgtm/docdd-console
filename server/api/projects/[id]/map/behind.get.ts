import { defineEventHandler, getRouterParam } from 'h3';

import { analyze } from '../../../../lib/analyze';
import { behindProposals } from '../../../../lib/coverage';
import { OutsideRootError, normalizeRoot } from '../../../../lib/paths';
import { WorkspaceError, readWorkspace } from '../../../../lib/workspace';
import { fail } from '../../../../utils/http';
import { fingerprintProject, memoByFingerprint } from '../../../../utils/memo';
import { findProject } from '../../../../utils/projects';

/**
 * Отметки возможностей, отставшие от фактов, с предложенной отметкой — для кнопки
 * «Отметить по фактам» (R-0101, docs/07-maps.md). Производное, не хранится;
 * черновик заводит `POST /map/capability` с `action: "status"`.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);

  try {
    const root = normalizeRoot(project.root);
    return memoByFingerprint(root, 'behind', () => fingerprintProject(root), () => {
      const workspace = readWorkspace(root);
      const analysis = analyze({ files: workspace.files, manifest: workspace.manifest, reports: workspace.reports, codeFiles: workspace.codeFiles });
      return { proposals: behindProposals(analysis.records, analysis.context.verifications) };
    });
  } catch (error) {
    if (error instanceof OutsideRootError) return fail(event, 403, 'outside_root', error.message, error.requested);
    if (error instanceof WorkspaceError) return fail(event, 422, error.code, error.message, error.detail);
    return fail(event, 500, 'behind_failed', 'Не удалось собрать отставшие отметки', String(error));
  }
});
