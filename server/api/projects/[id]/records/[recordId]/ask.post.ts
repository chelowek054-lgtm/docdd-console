import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { defineEventHandler, getRouterParam, readBody } from 'h3';
import { useStorage } from 'nitropack/runtime';

import { renderContextPack } from '../../../../../lib/context-pack';
import { resolveInside, toProjectPath } from '../../../../../lib/paths';
import { readWorkspace } from '../../../../../lib/workspace';
import { packFor, roleNeeds } from '../../../../../utils/context-service';
import { fail } from '../../../../../utils/http';
import { feedStream } from '../../../../../utils/job-feeds';
import { ask } from '../../../../../utils/llm';
import { findProject } from '../../../../../utils/projects';
import { sharedDenied } from '../../../../../utils/mode';

const ROLES = new Set(['manager', 'analyst', 'domain', 'observer']);

const DEFAULT_TEMPLATE = '<!-- КОНТЕКСТ -->\n\n## Вопрос\n\n<!-- ВОПРОС -->\n\nОтвечай только по контексту выше; чего в нём нет, того ты не видел — так и скажи.';

/**
 * Вопрос модели из карточки записи (T-0030): запрос строится на пакете контекста
 * записи, а ответ ложится черновиком заметки во входящее — запись он не правит.
 */
export default defineEventHandler(async (event) => {
  const denied = sharedDenied(event, 'Вопрос модели');
  if (denied) return denied;

  const id = getRouterParam(event, 'id') ?? '';
  const recordId = getRouterParam(event, 'recordId') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);

  const body = await readBody<{ question?: unknown; role?: unknown; exclude?: unknown }>(event);
  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  if (!question) return fail(event, 400, 'question_required', 'Пустой вопрос отправлять незачем');

  const inbox = readWorkspace(project.root).manifest.sources?.inbox?.[0];
  if (!inbox) return fail(event, 422, 'inbox_missing', 'Ответ некуда сложить: в манифесте нет `sources.inbox`');

  const exclude = new Set(Array.isArray(body?.exclude) ? body.exclude.filter((key): key is string => typeof key === 'string') : []);
  const role = typeof body?.role === 'string' && ROLES.has(body.role) ? body.role : '';
  // Глубина, issues и глоссарий — по нуждам роли из её шаблона, а не общим видом `ask`.
  const pack = packFor(project.root, recordId, role ? roleNeeds(role) : 'ask', { role, requestText: question });
  if (pack.chunks.length === 0) return fail(event, 404, 'record_not_found', `Записи \`${recordId}\` в проекте нет`);
  const raw = role ? await useStorage('assets:prompts').getItem(`roles:${role}.md`) : null;
  const text = typeof raw === 'string' ? raw : raw instanceof Uint8Array ? Buffer.from(raw).toString('utf8') : DEFAULT_TEMPLATE;
  const template = text.includes('\n---\n') || text.includes('\r\n---\r\n') ? text.slice(text.search(/\r?\n---\r?\n/) + 5).trimStart() : text;
  // Закрытые куски не уходят: допуск провайдера к закрытым данным пока не объявлен.
  const prompt = template.replace('<!-- КОНТЕКСТ -->', () => renderContextPack(pack, { exclude })).replace('<!-- ВОПРОС -->', () => question);

  // Лента задания (ADR-0034): ответ доживёт до обновления страницы, отменить можно только кнопкой.
  const stream = feedStream(event, id);
  const result = await ask(prompt, { cwd: project.root, access: 'none', effort: 'low', signal: stream.signal, onEvent: (modelEvent) => stream.send(modelEvent.kind, modelEvent) });
  if (!result.ok) {
    stream.send('error', { error: { ...result.failure, code: `llm_${result.failure.code}` } });
    stream.close();
    return;
  }

  const stamp = new Date().toISOString().slice(0, 10);
  let absolute = resolveInside(project.root, `${inbox}/вопрос-${recordId}-${stamp}.md`);
  for (let n = 2; existsSync(absolute); n += 1) absolute = resolveInside(project.root, `${inbox}/вопрос-${recordId}-${stamp}-${n}.md`);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `# Вопрос по ${recordId}\n\n${question}\n\n## Ответ модели (черновик)\n\n${result.answer.trim()}\n`, 'utf8');

  stream.send('done', { answer: result.answer, note: toProjectPath(project.root, absolute) });
  stream.close();
});
