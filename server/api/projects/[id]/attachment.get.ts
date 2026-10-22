import { readFileSync, statSync } from 'node:fs';

import { defineEventHandler, getQuery, getRouterParam, setHeader } from 'h3';

import { ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES, extOf, isAttachmentPath } from '../../../lib/attachments';
import { OutsideRootError, resolveInside } from '../../../lib/paths';
import { fail } from '../../../utils/http';
import { findProject } from '../../../utils/projects';

/** Отдать вложение (R-0099): только чтение, только из папки `attachments/` внутри корня. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  const path = getQuery(event)['path'];
  if (typeof path !== 'string' || !isAttachmentPath(path)) return fail(event, 400, 'path_invalid', 'Путь не похож на вложение: нужен файл из папки attachments');
  try {
    const absolute = resolveInside(project.root, path);
    const info = statSync(absolute);
    if (!info.isFile() || info.size > MAX_ATTACHMENT_BYTES) return fail(event, 404, 'file_not_found', `Вложения \`${path}\` нет`);
    setHeader(event, 'content-type', ATTACHMENT_TYPES[extOf(path)] ?? 'application/octet-stream');
    // Чужой скрипт из загруженного файла не должен исполняться на нашем origin.
    setHeader(event, 'content-security-policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
    setHeader(event, 'x-content-type-options', 'nosniff');
    return readFileSync(absolute);
  } catch (error) {
    if (error instanceof OutsideRootError) return fail(event, 403, 'outside_root', error.message, error.requested);
    return fail(event, 404, 'file_not_found', `Вложения \`${path}\` нет`);
  }
});
