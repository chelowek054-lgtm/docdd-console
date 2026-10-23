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
    readWorkspace(root);
    // Номер строки и сверку берём из самого файла, а не из разобранного манифеста: правка идёт по тексту,
    // и любое расхождение (кэш, правка рядом) иначе убрало бы чужую строку.
    const manifestPath = resolveInside(root, join(DEVELOPMENT_DIR, MANIFEST_FILE));
    const text = readFileSync(manifestPath, 'utf8');
    const ids = (value: unknown) => (Array.isArray(value) ? value.map((item) => (item as { id?: unknown } | null)?.id) : []);
    const custom = (load(text) as { maps?: { custom?: unknown } } | null)?.maps?.custom;
    const list = Array.isArray(custom) ? custom : [];
    const index = list.findIndex((item) => (item as { id?: unknown } | null)?.id === mapId);
    if (index < 0) return fail(event, 404, 'custom_map_not_found', `Карты «${mapId}» в \`maps.custom\` нет`);
    const who = whoIs(event);
    if (!canDeleteMap(list[index], who.user, who.admin)) {
      return fail(event, 403, 'forbidden', 'Удалить карту может тот, кто её завёл, или администратор');
    }
    const edit = removeCustomMap(text, index);
    if (!edit.ok) return fail(event, 422, 'manifest_form', edit.message);
    // Построчная правка не разбирает YAML — сверяем: ушла ровно эта строка, остальные на месте и по порядку.
    const expected = ids(list).filter((_, at) => at !== index);
    const after = ids((load(edit.text) as { maps?: { custom?: unknown } } | null)?.maps?.custom);
    if (JSON.stringify(after) !== JSON.stringify(expected)) {
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
