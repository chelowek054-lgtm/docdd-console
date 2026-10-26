import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { MOCKUP_LIMIT } from '../../../../../lib/design-mockups';
import { OutsideRootError } from '../../../../../lib/paths';
import { WorkspaceError } from '../../../../../lib/workspace';
import { fail } from '../../../../../utils/http';
import { MockupError, importMockup } from '../../../../../utils/mockups-service';
import { findProject } from '../../../../../utils/projects';

/** Импорт HTML-макета экрана из Claude Design (R-0106, docs/03-server-api.md). */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);

  const body = await readBody<{ screen?: unknown; name?: unknown; content?: unknown; title?: unknown; actor?: unknown }>(event);
  const screen = typeof body?.screen === 'string' ? body.screen : '';
  const name = typeof body?.name === 'string' ? body.name : '';
  const content = typeof body?.content === 'string' ? Buffer.from(body.content, 'base64') : null;
  if (!name || !content || content.length === 0) return fail(event, 400, 'file_required', 'Нужен файл: .html или .zip экспорт Claude Design');
  if (content.length > MOCKUP_LIMIT) return fail(event, 400, 'mockup_too_big', `Файл больше ${MOCKUP_LIMIT / 1024 / 1024} МБ`);

  try {
    return importMockup(project.root, { screen, name, content, actor: typeof body?.actor === 'string' ? body.actor : '', ...(typeof body?.title === 'string' ? { title: body.title } : {}) });
  } catch (error) {
    if (error instanceof MockupError) return fail(event, error.status, error.code, error.message);
    if (error instanceof OutsideRootError) return fail(event, 403, 'outside_root', error.message, error.requested);
    if (error instanceof WorkspaceError) return fail(event, 422, error.code, error.message, error.detail);
    return fail(event, 500, 'mockup_failed', 'Не удалось добавить макет', String(error));
  }
});
