import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { defineEventHandler, getRouterParam } from 'h3';
import { load } from 'js-yaml';

import { dropCache } from '../../../../../../lib/cache';
import { canDeleteMap } from '../../../../../../lib/custom-maps';
import { removeCustomMap } from '../../../../../../lib/manifest-write';
import { OutsideRootError, normalizeRoot, resolveInside } from '../../../../../../lib/paths';
import { DEVELOPMENT_DIR, MANIFEST_FILE, WorkspaceError, readWorkspace } from '../../../../../../lib/workspace';
import { fail } from '../../../../../../utils/http';
import { whoIs } from '../../../../../../utils/job-feeds';
import { findProject } from '../../../../../../utils/projects';

/**
 * Удаление рабочей карты (docs/adr/0036-delete-working-map.md): только строка определения в
 * `project.yaml`; записи `map` целы, строка возвращается из git. Удаляет создатель или администратор.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const mapId = getRouterParam(event, 'mapId') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);

  try {
    const root = normalizeRoot(project.root);
    const custom = readWorkspace(root).manifest.maps?.custom;
    const list = Array.isArray(custom) ? custom : [];
    const index = list.findIndex((item) => (item as { id?: unknown } | null)?.id === mapId);
    if (index < 0) return fail(event, 404, 'custom_map_not_found', `Карты «${mapId}» в \`maps.custom\` нет`);
    const who = whoIs(event);
    if (!canDeleteMap(list[index], who.user, who.admin)) {
      return fail(event, 403, 'forbidden', 'Удалить карту может тот, кто её завёл, или администратор');
    }
    const manifestPath = resolveInside(root, join(DEVELOPMENT_DIR, MANIFEST_FILE));
    const edit = removeCustomMap(readFileSync(manifestPath, 'utf8'), index);
    if (!edit.ok) return fail(event, 422, 'manifest_form', edit.message);
    // Построчная правка не разбирает YAML — сверяем результат, прежде чем писать файл человека.
    const after = (load(edit.text) as { maps?: { custom?: unknown } } | null)?.maps?.custom;
    if (!Array.isArray(after) || after.length !== list.length - 1 || after.some((item) => (item as { id?: unknown } | null)?.id === mapId)) {
      return fail(event, 422, 'manifest_form', 'Не удалось точечно убрать строку `maps.custom` — уберите карту вручную');
    }
    writeFileSync(manifestPath, edit.text, 'utf8');
    dropCache(root);
    return { removed: mapId, by: who.user, file: `${DEVELOPMENT_DIR}/${MANIFEST_FILE}` };
  } catch (error) {
    if (error instanceof OutsideRootError) return fail(event, 403, 'outside_root', error.message, error.requested);
    if (error instanceof WorkspaceError) return fail(event, 422, error.code, error.message, error.detail);
    return fail(event, 500, 'custom_map_failed', 'Не удалось удалить карту', String(error));
  }
});
