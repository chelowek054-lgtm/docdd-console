import { defineEventHandler, getQuery, getRouterParam, setHeader } from 'h3';

import { chatKey, getChat, listChats, validChatId } from '../../../../lib/project-chat';
import { fail } from '../../../../utils/http';
import { findProject } from '../../../../utils/projects';

export default defineEventHandler(async (event) => {
  const project = await findProject(getRouterParam(event, 'id') ?? '');
  if (!project) return fail(event, 404, 'project_not_found', 'Проект не найден');
  const user = event.context.user as { login: string; agent?: boolean } | undefined;
  if (user?.agent) return fail(event, 403, 'forbidden', 'История чатов доступна пользователю');
  setHeader(event, 'Cache-Control', 'no-store');
  const key = chatKey(project.root, user?.login ?? 'local');
  const id = getQuery(event).chat;
  if (id === undefined) return { chats: await listChats(key), owner: user?.login ?? 'local' };
  if (!validChatId(id)) return fail(event, 400, 'chat_invalid', 'Недопустимый идентификатор чата');
  const chat = await getChat(key, id);
  return chat ?? fail(event, 404, 'chat_not_found', 'Чат не найден');
});
