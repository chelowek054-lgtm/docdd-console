import { defineEventHandler, getRouterParam, readBody } from 'h3';
import { useStorage } from 'nitropack/runtime';

import type { GrillAnswer, GrillMode } from '../../../../lib/grill';
import { WorkspaceError } from '../../../../lib/workspace';
import { grillRefusal, grillStep, type GrillInput } from '../../../../utils/grill-service';
import { fail } from '../../../../utils/http';
import { feedStream, whoIs } from '../../../../utils/job-feeds';
import { askRouted } from '../../../../utils/llm-gateway';
import { sharedDenied } from '../../../../utils/mode';
import { findProject } from '../../../../utils/projects';

const answersOf = (raw: unknown): GrillAnswer[] => (Array.isArray(raw)
  ? (raw as { id?: unknown; text?: unknown }[]).flatMap((item) => (typeof item?.id === 'string' && typeof item.text === 'string' ? [{ id: item.id, text: item.text }] : []))
  : []);

/**
 * Ход допроса проекта (R-0114): начать, ответить, завершить. Модель работает только на чтение и
 * только задаёт вопросы; ответы человека пишутся в файл сессии раньше, чем идёт запрос.
 */
export default defineEventHandler(async (event) => {
  const denied = sharedDenied(event, 'Допрос проекта');
  if (denied) return denied;
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);

  const body = await readBody<{ action?: unknown; mode?: unknown; path?: unknown; answers?: unknown }>(event);
  const input: GrillInput = {
    action: body?.action as GrillInput['action'],
    ...(typeof body?.mode === 'string' ? { mode: body.mode as GrillMode } : {}),
    ...(typeof body?.path === 'string' ? { path: body.path } : {}),
    answers: answersOf(body?.answers)
  };

  try {
    const refused = grillRefusal(project.root, input);
    if (refused) return fail(event, refused.status, refused.code, refused.message);
  } catch (error) {
    if (error instanceof WorkspaceError) return fail(event, 422, error.code, error.message, error.detail);
    throw error;
  }

  const raw = await useStorage('assets:prompts').getItem('grill.md');
  const template = typeof raw === 'string' ? raw : Buffer.from(raw as Uint8Array).toString('utf8');
  const stream = feedStream(event, id);
  try {
    const outcome = await grillStep(project.root, input, template, (prompt, access) => askRouted('grill', {
      projectId: id,
      user: whoIs(event).user,
      onJob: (job) => stream.queued(job)
    }, prompt, {
      cwd: project.root,
      access,
      onEvent: (modelEvent) => stream.send(modelEvent.kind, modelEvent)
    }));
    if (outcome.ok) stream.send('done', outcome.view);
    else stream.send('error', { error: { code: outcome.code, message: outcome.message } });
  } catch (error) {
    stream.send('error', { error: { code: 'grill_failed', message: 'Ход допроса не удался', detail: String(error) } });
  }
  stream.close();
});
