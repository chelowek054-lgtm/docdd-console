import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { OutsideRootError } from '../../../../lib/paths';
import type { SourceKind } from '../../../../lib/source-detect';
import { fail } from '../../../../utils/http';
import { findProject } from '../../../../utils/projects';
import { applySources } from '../../../../utils/source-scan';

const KINDS = ['code', 'client', 'docs', 'tests'];

/**
 * Записать подтверждённые человеком папки в `sources` манифеста (R-0077): `{ folders: [{ kind, path }] }`.
 * Объединяет с названным, комментарии манифеста не трогает. Путь вне корня — `403`, нет папки — `404`.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  const body = await readBody<{ folders?: unknown }>(event);
  const picks = (Array.isArray(body?.folders) ? body.folders : []).filter((item): item is { kind: SourceKind; path: string } => {
    const row = item as { kind?: unknown; path?: unknown } | null;
    return !!row && KINDS.includes(String(row.kind)) && typeof row.path === 'string' && row.path.trim() !== '';
  });
  if (picks.length === 0) return fail(event, 400, 'folders_required', 'Не названы папки: нужен непустой список { kind, path }');
  try {
    const outcome = applySources(project.root, picks);
    return outcome.ok ? outcome : fail(event, outcome.code === 'path_not_found' ? 404 : 409, outcome.code, outcome.message);
  } catch (error) {
    if (error instanceof OutsideRootError) return fail(event, 403, 'outside_root', error.message, error.requested);
    return fail(event, 500, 'apply_failed', 'Не удалось записать манифест', String(error));
  }
});
