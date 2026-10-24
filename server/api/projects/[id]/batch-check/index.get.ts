import { defineEventHandler, getQuery, getRouterParam } from 'h3';

import { analyze } from '../../../../lib/analyze';
import { batchGaps } from '../../../../lib/batch-check';
import { normalizeRoot } from '../../../../lib/paths';
import { WorkspaceError, readWorkspace } from '../../../../lib/workspace';
import { fail } from '../../../../utils/http';
import { buildProjectMap } from '../../../../utils/map-service';
import { findProject } from '../../../../utils/projects';

/**
 * Сверка пачки по возможности (R-0092, docs/03-server-api.md): `?capability=<id>`.
 * Пачка — задачи, чьи `affects` называют карты, объявившие возможность, и всё
 * связанное с ними. Ответ — пробелы; пустой список — пачка чистая.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const capability = String(getQuery(event)['capability'] ?? '').trim();
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  if (!capability) return fail(event, 400, 'capability_required', 'Не названа возможность: ?capability=<id>');
  try {
    const root = normalizeRoot(project.root);
    const picture = buildProjectMap(root);
    const item = picture.functional.capabilities.find((entry) => entry.id === capability) as { declaredBy?: string } | undefined;
    if (!item) return fail(event, 404, 'capability_not_found', `Возможности \`${capability}\` в карте нет`);
    const workspace = readWorkspace(root);
    const { records } = analyze({ files: workspace.files, manifest: workspace.manifest, reports: workspace.reports, codeFiles: workspace.codeFiles });
    const gaps = batchGaps(records, item.declaredBy ? [item.declaredBy] : []);
    return { capability, maps: item.declaredBy ? [item.declaredBy] : [], gaps, clean: gaps.length === 0 };
  } catch (error) {
    if (error instanceof WorkspaceError) return fail(event, 422, error.code, error.message, error.detail);
    return fail(event, 500, 'batch_check_failed', 'Не удалось собрать сверку пачки', String(error));
  }
});
