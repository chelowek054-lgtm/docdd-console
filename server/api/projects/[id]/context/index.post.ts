import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { renderContextPack } from '../../../../lib/context-pack';
import { fail } from '../../../../utils/http';
import { packFor } from '../../../../utils/context-service';
import { findProject } from '../../../../utils/projects';

/** Грубая оценка: около трёх знаков русского текста на токен. Цена — ориентир, а не счёт. */
const CHARS_PER_TOKEN = 3;
const USD_PER_MILLION_INPUT_TOKENS = 3;

/**
 * «Что уйдёт модели» (R-0011): состав пакета до отправки. Исключённые куски и
 * закрытые для недопущенного провайдера не попадают в `prompt` — его и отправляют.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const body = await readBody<{ centerId?: unknown; need?: unknown; exclude?: unknown; allowConfidential?: unknown }>(event);
  const centerId = typeof body?.centerId === 'string' ? body.centerId : '';
  if (!centerId) return fail(event, 400, 'center_required', 'Не названа запись, вокруг которой собирается контекст');
  const exclude = new Set(Array.isArray(body?.exclude) ? body.exclude.filter((key): key is string => typeof key === 'string') : []);
  const allowConfidential = body?.allowConfidential === true;

  try {
    const pack = packFor(project.root, centerId, typeof body?.need === 'string' ? body.need : 'ask');
    const sent = pack.chunks.filter((chunk) => !exclude.has(chunk.key) && (allowConfidential || !chunk.confidential));
    const size = sent.reduce((sum, chunk) => sum + chunk.size, 0);
    const tokens = Math.ceil(size / CHARS_PER_TOKEN);
    return {
      chunks: pack.chunks.map((chunk) => ({
        key: chunk.key, kind: chunk.kind, title: chunk.title, why: chunk.why, size: chunk.size, confidential: chunk.confidential,
        excluded: exclude.has(chunk.key), withheld: chunk.confidential && !allowConfidential
      })),
      cut: pack.cut,
      size,
      budget: pack.budget,
      tokens,
      costUsd: Math.round((tokens / 1_000_000) * USD_PER_MILLION_INPUT_TOKENS * 10_000) / 10_000,
      prompt: renderContextPack(pack, { exclude, allowConfidential })
    };
  } catch (error) {
    return fail(event, 500, 'context_failed', 'Не удалось собрать пакет контекста', String(error));
  }
});
