import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { attachmentFolder, checkAttachment } from '../../../lib/attachments';
import { OutsideRootError, normalizeRoot, resolveInside } from '../../../lib/paths';
import { WorkspaceError, readWorkspace } from '../../../lib/workspace';
import { fail } from '../../../utils/http';
import { findProject } from '../../../utils/projects';
import { today } from '../../../utils/record-write';

/**
 * Загрузка вложения к прогону или дефекту (R-0099): `{ name, data }`, где `data` —
 * содержимое файла в base64. Файл ложится в `<tests>/attachments/<дата>/` внутри
 * корня проекта; в ответе — путь, который кладут в отчёт.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  const body = await readBody<{ name?: unknown; data?: unknown }>(event);
  const name = typeof body?.name === 'string' ? body.name : '';
  const data = typeof body?.data === 'string' ? body.data : '';
  const bytes = Buffer.from(data, 'base64');
  const checked = checkAttachment(name, bytes.length);
  if (!checked.ok) return fail(event, 400, checked.code, checked.message);
  try {
    const root = normalizeRoot(project.root);
    const testsFolder = readWorkspace(root).manifest.paths?.tests;
    if (!testsFolder) return fail(event, 409, 'tests_not_configured', 'В манифесте не назван раздел \`paths.tests\`: вложению некуда лечь');
    const folder = attachmentFolder(testsFolder, today());
    const dir = resolveInside(root, folder);
    mkdirSync(dir, { recursive: true });
    // Имя не затирает чужое: занято — добавляется номер.
    let file = checked.name;
    for (let n = 2; existsSync(join(dir, file)); n += 1) file = checked.name.replace(/(\.[^.]+)$/, `-${n}$1`);
    writeFileSync(join(dir, file), bytes);
    return { path: `${folder}/${file}`, kind: checked.kind, size: bytes.length };
  } catch (error) {
    if (error instanceof OutsideRootError) return fail(event, 403, 'outside_root', error.message, error.requested);
    if (error instanceof WorkspaceError) return fail(event, 422, error.code, error.message, error.detail);
    return fail(event, 500, 'attachment_failed', 'Не удалось сохранить вложение', String(error));
  }
});
