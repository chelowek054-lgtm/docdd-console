import { defineEventHandler, getRouterParam, readBody } from 'h3';
import { useStorage } from 'nitropack/runtime';

import { inboxFile, intentQuestions } from '../../../../utils/grill-service';
import { fail } from '../../../../utils/http';
import { feedStream, whoIs } from '../../../../utils/job-feeds';
import { askRouted } from '../../../../utils/llm-gateway';
import { sharedDenied } from '../../../../utils/mode';
import { findProject } from '../../../../utils/projects';

/** Короткий допрос на намерение (R-0116): до трёх вопросов по заметке, модель без инструментов. */
export default defineEventHandler(async (event) => {
  const denied = sharedDenied(event, 'Допрос проекта');
  if (denied) return denied;
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);

  const body = await readBody<{ note?: unknown }>(event);
  const note = typeof body?.note === 'string' ? body.note : '';
  if (!note) return fail(event, 400, 'note_required', 'Не названа заметка намерения');
  const file = inboxFile(project.root, note);
  if (!file.ok) return fail(event, file.status, file.code, file.message);

  const raw = await useStorage('assets:prompts').getItem('grill-intent.md');
  const template = typeof raw === 'string' ? raw : Buffer.from(raw as Uint8Array).toString('utf8');
  const stream = feedStream(event, id);
  const outcome = await intentQuestions(project.root, note, template, (prompt, access) => askRouted('grill', {
    projectId: id,
    user: whoIs(event).user,
    onJob: (job) => stream.queued(job)
  }, prompt, {
    cwd: project.root,
    access,
    effort: 'low',
    onEvent: (modelEvent) => stream.send(modelEvent.kind, modelEvent)
  }));
  if (outcome.ok) stream.send('done', { questions: outcome.questions, ...(outcome.problem ? { problem: outcome.problem } : {}) });
  else stream.send('error', { error: { code: outcome.code, message: outcome.message } });
  stream.close();
});
