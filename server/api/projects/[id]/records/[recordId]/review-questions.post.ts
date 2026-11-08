import { defineEventHandler, getRouterParam } from 'h3';
import { useStorage } from 'nitropack/runtime';

import { parseReviewQuestions } from '../../../../../lib/review-questions';
import { WorkspaceError } from '../../../../../lib/workspace';
import { fail } from '../../../../../utils/http';
import { feedStream, whoIs } from '../../../../../utils/job-feeds';
import { askRouted } from '../../../../../utils/llm-gateway';
import { sharedDenied } from '../../../../../utils/mode';
import { findProject } from '../../../../../utils/projects';
import { reviewQuestionsPrompt } from '../../../../../utils/review-questions-service';

/** Вопросы человеку по задаче на проверке (R-0117). Модель без инструментов: всё нужное в запросе. */
export default defineEventHandler(async (event) => {
  const denied = sharedDenied(event, 'Проверка вопросами');
  if (denied) return denied;
  const id = getRouterParam(event, 'id') ?? '';
  const recordId = getRouterParam(event, 'recordId') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);

  const raw = await useStorage('assets:prompts').getItem('review-questions.md');
  const template = typeof raw === 'string' ? raw : Buffer.from(raw as Uint8Array).toString('utf8');
  let built: Awaited<ReturnType<typeof reviewQuestionsPrompt>>;
  try {
    built = await reviewQuestionsPrompt(project.root, recordId, template);
  } catch (error) {
    if (error instanceof WorkspaceError) return fail(event, 422, error.code, error.message, error.detail);
    throw error;
  }
  if (!built.ok) return fail(event, built.status, built.code, built.message);

  const stream = feedStream(event, id);
  const result = await askRouted('review-questions', {
    projectId: id,
    user: whoIs(event).user,
    taskId: recordId,
    onJob: (job) => stream.queued(job)
  }, built.prompt, {
    cwd: project.root,
    access: 'none',
    effort: 'low',
    onEvent: (modelEvent) => stream.send(modelEvent.kind, modelEvent)
  });
  if (!result.ok) {
    stream.send('error', { error: { ...result.failure, code: `llm_${result.failure.code}` } });
    stream.close();
    return;
  }
  const parsed = parseReviewQuestions(result.answer);
  stream.send('done', parsed.ok ? { questions: parsed.questions } : { questions: [], problem: parsed.problem });
  stream.close();
});
