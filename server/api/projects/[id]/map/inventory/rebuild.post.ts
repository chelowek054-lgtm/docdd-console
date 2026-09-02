import { existsSync, readFileSync } from 'node:fs';
import { defineEventHandler, getRouterParam } from 'h3';

import { normalizeRoot, resolveInside } from '../../../../../lib/paths';
import { WorkspaceError } from '../../../../../lib/workspace';
import { fail } from '../../../../../utils/http';
import { rebuildDescribed } from '../../../../../utils/inventory-service';
import { findProject } from '../../../../../utils/projects';

/**
 * Пересчитать опись строго по действующим подтверждённым картам
 * (docs/07-maps.md, раздел «Опись теряет силу вместе с картой»).
 *
 * Опись копится добавлением: подтвердили карту — файлы отметились описанными
 * навсегда, даже если саму карту потом пометили `superseded`. Без пересчёта
 * такие файлы никогда не попадут в очередь снова — их некому предложить
 * модели заново.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  try {
    const root = normalizeRoot(project.root);
    const described = rebuildDescribed(root, (path) => {
      const absolute = resolveInside(root, path);
      return existsSync(absolute) ? readFileSync(absolute, 'utf8') : '';
    });
    return { described };
  } catch (error) {
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'rebuild_failed', 'Не удалось пересчитать опись', String(error));
  }
});
