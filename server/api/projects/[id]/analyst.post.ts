import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { analystPrompt, isAnalystMode, type AnalystRecord } from '../../../lib/analyst';
import { parseGlossary } from '../../../lib/glossary';
import { parseRecord } from '../../../lib/parse';
import { resolveInside } from '../../../lib/paths';
import { fail } from '../../../utils/http';
import { loadIndex } from '../../../utils/index-service';
import { findProject } from '../../../utils/projects';

/** Собирает запрос помощника аналитика; отправляет его клиент через /api/llm/ask, как остальные запросы. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  const body = await readBody<{ recordId?: unknown; mode?: unknown }>(event);
  if (!isAnalystMode(body?.mode) || typeof body?.recordId !== 'string') return fail(event, 400, 'analyst_args', 'Нужны режим и id требования');

  const requirements: AnalystRecord[] = loadIndex(project.root).records
    .filter((record) => record.type === 'requirement')
    .map((record) => {
      const parsed = parseRecord(readFileSync(resolveInside(project.root, record.path), 'utf8'), { path: record.path });
      return { id: record.id, title: record.title, body: parsed.ok ? parsed.record.body : '' };
    });
  const target = requirements.find((item) => item.id === body.recordId);
  if (!target) return fail(event, 404, 'record_not_found', `Требования \`${body.recordId}\` в проекте нет`);

  const glossaryPath = resolveInside(project.root, join('docs', 'development', 'glossary.md'));
  const glossary = existsSync(glossaryPath) ? parseGlossary(readFileSync(glossaryPath, 'utf8')) : [];
  return { prompt: analystPrompt(body.mode, target, requirements, glossary) };
});
