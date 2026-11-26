import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { chatKey, saveChat, validChatId, type ProjectChat } from '../../../../lib/project-chat';
import { fail } from '../../../../utils/http';
import { findProject } from '../../../../utils/projects';

export default defineEventHandler(async (event) => {
  const project = await findProject(getRouterParam(event, 'id') ?? '');
  if (!project) return fail(event, 404, 'project_not_found', 'Проект не найден');
  const user = event.context.user as { login: string; agent?: boolean } | undefined;
  if (user?.agent) return fail(event, 403, 'forbidden', 'История чатов доступна пользователю');
  const body = await readBody<Partial<ProjectChat> | null>(event);
  if (!body || !validChatId(body.id) || typeof body.title !== 'string' || !body.title.trim() ||
      !Number.isSafeInteger(body.revision) || !Array.isArray(body.turns) || JSON.stringify(body.turns).length > 4_000_000) {
    return fail(event, 400, 'chat_invalid', 'Проверьте данные чата');
  }
  const saved = await saveChat(chatKey(project.root, user?.login ?? 'local'), {
    id: body.id, title: body.title.trim().slice(0, 140), updated: '', archived: body.archived === true,
    record: typeof body.record === 'string' ? body.record.slice(0, 100) : '',
    phase: typeof body.phase === 'string' ? body.phase.slice(0, 100) : '',
    ...(typeof body.providerId === 'string' && /^[\w:.-]{1,100}$/.test(body.providerId) ? { providerId: body.providerId } : {}),
    revision: body.revision!, turns: body.turns
  });
  return saved ?? fail(event, 409, 'chat_changed', 'Чат изменён в другой вкладке. Обновите страницу.');
});
