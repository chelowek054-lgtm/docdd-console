import { defineEventHandler, getRouterParam } from 'h3';

import { customDefinitions, customMapView, type CustomMapView } from '../../../../../lib/custom-maps';
import { OutsideRootError, normalizeRoot } from '../../../../../lib/paths';
import { WorkspaceError, readWorkspace } from '../../../../../lib/workspace';
import { fail } from '../../../../../utils/http';
import { buildProjectMap } from '../../../../../utils/map-service';
import { fingerprintProject, memoByFingerprint } from '../../../../../utils/memo';
import { findProject } from '../../../../../utils/projects';

/**
 * Пользовательские карты (docs/adr/0028-custom-maps.md): годные определения из
 * манифеста, беды неверных и вид каждой карты из той же сложенной картины, что
 * отдаёт `GET …/map`, — второй свёртки записей нет, расходиться не с чем.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  try {
    const root = normalizeRoot(project.root);
    const { definitions, problems } = customDefinitions(readWorkspace(root).manifest);
    const projectMap = memoByFingerprint(project.root, 'map', () => fingerprintProject(project.root), () => buildProjectMap(project.root));
    const maps: Record<string, CustomMapView> = {};
    for (const def of definitions) maps[def.id] = customMapView(projectMap, def);
    return { definitions, problems, maps };
  } catch (error) {
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    return fail(event, 500, 'read_failed', 'Не удалось собрать пользовательские карты', String(error));
  }
});
