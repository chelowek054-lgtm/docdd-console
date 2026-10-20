import { defineEventHandler, getQuery, getRouterParam } from 'h3';

import { OutsideRootError } from '../../../../lib/paths';
import { WorkspaceError } from '../../../../lib/workspace';
import { fail } from '../../../../utils/http';
import { buildProjectMap, mapKindView, MAP_KINDS, type MapKind } from '../../../../utils/map-service';
import { findProject } from '../../../../utils/projects';
import { fingerprintProject, memoByFingerprint } from '../../../../utils/memo';

/*
 * Маршрут `/api/projects/:id/map`. Папка `map` внутри `[id]` — тот же приём,
 * что и с `index`: буквальный сегмент пути в Nitro иначе не получить.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const kind = String(getQuery(event)['kind'] ?? '');
  if (kind && !(MAP_KINDS as readonly string[]).includes(kind)) {
    return fail(event, 400, 'bad_kind', `Неизвестный вид карты \`${kind}\``, `Допустимо: ${MAP_KINDS.join(', ')}`);
  }

  try {
    // Память процесса: пока отпечаток файлов проекта тот же, карта не пересобирается (T-0102).
    const full = memoByFingerprint(project.root, 'map', () => fingerprintProject(project.root), () => buildProjectMap(project.root));
    // Без `kind` — весь ответ, как раньше; с ним — один вид и сводка: страница не тащит в HTML все карты сразу (T-0112).
    return kind ? mapKindView(await full, kind as MapKind) : full;
  } catch (error) {
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    return fail(event, 500, 'read_failed', 'Не удалось собрать карту проекта', String(error));
  }
});
