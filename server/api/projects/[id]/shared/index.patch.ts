import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { normalizeRoot } from '../../../../lib/paths';
import { fail } from '../../../../utils/http';
import { toggleSourceTag } from '../../../../utils/shared-service';
import { findProject } from '../../../../utils/projects';

/**
 * Галочка тега на экране «Практики» (docs/11-shared-sources.md): включить
 * или выключить один тег у одного источника. Список источников (путь, сам
 * факт подключения) этот маршрут не меняет — только теги у уже названного
 * источника.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const body = await readBody<{ path?: unknown; tag?: unknown; enabled?: unknown }>(event);
  const path = typeof body?.path === 'string' ? body.path : '';
  const tag = typeof body?.tag === 'string' ? body.tag : '';
  const enabled = body?.enabled === true;

  if (!path) return fail(event, 400, 'path_required', 'Не указан путь источника');
  if (!tag) return fail(event, 400, 'tag_required', 'Не указан тег');

  try {
    const root = normalizeRoot(project.root);
    const outcome = toggleSourceTag(root, path, tag, enabled);
    if (!outcome.ok) {
      return fail(event, 422, outcome.code, outcome.message);
    }
    return { ok: true };
  } catch (error) {
    return fail(event, 500, 'shared_patch_failed', 'Не удалось изменить теги источника', String(error));
  }
});
