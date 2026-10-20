import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { defineEventHandler, getRouterParam, readBody } from 'h3';

import {
  addReply,
  addThread,
  closeThread,
  discussionPath,
  emptyDiscussion,
  parseDiscussion,
  serializeDiscussion,
  type Discussion
} from '../../../../../lib/discussion';
import { OutsideRootError, resolveInside } from '../../../../../lib/paths';
import { fail } from '../../../../../utils/http';
import { loadIndex } from '../../../../../utils/index-service';
import { findProject } from '../../../../../utils/projects';

interface Body {
  /** `thread` — новое замечание, `reply` — ответ, `close` — закрыть. */
  action?: 'thread' | 'reply' | 'close';
  author?: string;
  text?: string;
  threadId?: string;
}

/**
 * Пишет только файл обсуждения рядом с записью: текст документа и front matter
 * не трогаются (R-0060), поэтому подтверждённая запись обсуждается свободно.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const recordId = getRouterParam(event, 'recordId') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  const body = (await readBody<Body>(event)) ?? {};
  const author = (body.author ?? '').trim() || 'local';
  const text = (body.text ?? '').trim();
  const threadId = body.threadId ?? '';

  try {
    const record = loadIndex(project.root).records.find((item) => item.id === recordId);
    if (!record) return fail(event, 404, 'record_not_found', `Записи \`${recordId}\` в проекте нет`);
    const file = resolveInside(project.root, discussionPath(record.path));
    const current = existsSync(file) ? parseDiscussion(readFileSync(file, 'utf8')) : emptyDiscussion();
    const now = new Date();

    let next: Discussion | null;
    if (body.action === 'thread') {
      if (!text) return fail(event, 400, 'text_required', 'Нужен текст замечания');
      next = addThread(current, author, text, now);
    } else if (body.action === 'reply') {
      if (!text) return fail(event, 400, 'text_required', 'Нужен текст ответа');
      next = addReply(current, threadId, author, text, now);
    } else if (body.action === 'close') {
      next = closeThread(current, threadId, author, now);
    } else {
      return fail(event, 400, 'bad_action', 'Действие: thread, reply или close');
    }
    if (!next) return fail(event, 404, 'thread_not_found', `Замечания \`${threadId}\` нет`);

    writeFileSync(file, serializeDiscussion(next), 'utf8');
    return next;
  } catch (error) {
    if (error instanceof OutsideRootError) return fail(event, 403, 'outside_root', error.message, error.requested);
    return fail(event, 500, 'write_failed', 'Не удалось записать обсуждение', String(error));
  }
});
