import { readFileSync, statSync } from 'node:fs';

import { defineEventHandler, getQuery, getRouterParam } from 'h3';

import { OutsideRootError, resolveInside } from '../../../lib/paths';
import { fail } from '../../../utils/http';
import { findProject } from '../../../utils/projects';

/** Показ файла кода по ссылке из документа: только чтение, только внутри корня. */
const MAX_BYTES = 512 * 1024;

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const path = getQuery(event)['path'];
  if (typeof path !== 'string' || path === '') {
    return fail(event, 400, 'path_required', 'Не указан путь к файлу');
  }

  try {
    const absolute = resolveInside(project.root, path);
    const info = statSync(absolute);
    if (!info.isFile()) {
      return fail(event, 404, 'file_not_found', `По пути \`${path}\` файла нет`);
    }
    if (info.size > MAX_BYTES) {
      return fail(
        event,
        400,
        'file_too_large',
        `Файл \`${path}\` больше ${Math.round(MAX_BYTES / 1024)} КБ: такой показывать незачем, откройте его в редакторе`
      );
    }
    return { path, size: info.size, content: readFileSync(absolute, 'utf8') };
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    return fail(event, 404, 'file_not_found', `Файл \`${path}\` не прочитан`, String(error));
  }
});
