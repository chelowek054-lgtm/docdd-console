import { defineEventHandler, getRouterParam } from 'h3';

import { analyze } from '../../../../lib/analyze';
import { capabilityCoverage } from '../../../../lib/coverage';
import { groupModules } from '../../../../lib/groups';
import { OutsideRootError, normalizeRoot } from '../../../../lib/paths';
import { WorkspaceError, readWorkspace } from '../../../../lib/workspace';
import { fail } from '../../../../utils/http';
import { buildProjectMap } from '../../../../utils/map-service';
import { findProject } from '../../../../utils/projects';

/**
 * Что стоит за возможностями в процессе: требования, задачи, проверки и код
 * (docs/07-maps.md, «Покрытие процессом»). Производное от записей, отчётов и
 * общей картины — нигде не хранится. Отдельный маршрут, потому что `GET /map`
 * читает только карты, а здесь нужны ещё и требования, задачи и отчёты.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  try {
    const root = normalizeRoot(project.root);
    const map = buildProjectMap(root);
    const workspace = readWorkspace(root);
    const analysis = analyze({
      files: workspace.files,
      manifest: workspace.manifest,
      reports: workspace.reports,
      codeFiles: workspace.codeFiles
    });

    const grouping = groupModules(map.codemap.modules, map.codemap.imports, map.codemap.groups);
    const coverage = capabilityCoverage({
      capabilities: map.functional.capabilities,
      records: analysis.records,
      verifications: analysis.context.verifications,
      groups: grouping.groups.map((group) => ({
        id: group.id,
        capability: group.capability,
        modules: group.members.length
      }))
    });
    return { coverage: Object.fromEntries(coverage) };
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'coverage_failed', 'Не удалось собрать покрытие', String(error));
  }
});
