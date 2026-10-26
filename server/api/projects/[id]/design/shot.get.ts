import { existsSync, readFileSync } from 'node:fs';

import { defineEventHandler, getQuery, getRouterParam, setHeader } from 'h3';

import { DEFAULT_SCREENS_DIR } from '../../../../lib/design-screens';
import { OutsideRootError, normalizeRoot, resolveInside } from '../../../../lib/paths';
import { readManifest } from '../../../../lib/workspace';
import { fail } from '../../../../utils/http';
import { findProject } from '../../../../utils/projects';

/** Снимок реализации для показа рядом с макетом (R-0106): только PNG из каталога снимков. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  const path = String(getQuery(event)['path'] ?? '').replace(/\\/g, '/');
  try {
    const root = normalizeRoot(project.root);
    const dir = (readManifest(root).design?.screens ?? DEFAULT_SCREENS_DIR).replace(/\\/g, '/').replace(/\/+$/, '');
    if (!path.startsWith(`${dir}/`) || !path.endsWith('.png') || path.split('/').includes('..')) return fail(event, 400, 'shot_path_invalid', 'Снимок — PNG из каталога снимков экранов');
    const absolute = resolveInside(root, path);
    if (!existsSync(absolute)) return fail(event, 404, 'shot_not_found', `Снимка \`${path}\` нет`);
    setHeader(event, 'Content-Type', 'image/png');
    return readFileSync(absolute);
  } catch (error) {
    if (error instanceof OutsideRootError) return fail(event, 403, 'outside_root', error.message, error.requested);
    return fail(event, 500, 'shot_failed', 'Не удалось отдать снимок', String(error));
  }
});
