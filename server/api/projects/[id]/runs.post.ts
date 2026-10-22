import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { fail } from '../../../utils/http';
import { findProject } from '../../../utils/projects';
import type { RunState } from '../../../lib/manual-report';
import { recordRun } from '../../../utils/verified-service';

/**
 * Прогон набора проверок на сборку или релиз (R-0062): тело — `build`, `results`
 * (V-номер → passed/failed/skipped/blocked), `reasons` (причина каждого blocked —
 * обязательна), необязательные `actor`, `by`, `note`.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  const body = await readBody<{ build?: unknown; results?: unknown; actor?: unknown; by?: unknown; note?: unknown; reasons?: unknown }>(event);
  const results: Record<string, RunState> = {};
  const reasons: Record<string, string> = {};
  if (body?.reasons && typeof body.reasons === 'object') {
    for (const [key, value] of Object.entries(body.reasons)) if (typeof value === 'string' && value.trim()) reasons[key] = value.trim();
  }
  if (body?.results && typeof body.results === 'object') {
    for (const [key, value] of Object.entries(body.results)) {
      if (value === 'passed' || value === 'failed' || value === 'skipped' || value === 'blocked') results[key] = value;
    }
  }
  try {
    const outcome = recordRun(
      project.root,
      typeof body?.build === 'string' ? body.build : '',
      results,
      typeof body?.actor === 'string' ? body.actor : '',
      { by: typeof body?.by === 'string' ? body.by : '', note: typeof body?.note === 'string' ? body.note : '', reasons, login: (event.context['user'] as { login?: string } | undefined)?.login }
    );
    if (!outcome.ok) return fail(event, outcome.status, outcome.code, outcome.message);
    return outcome;
  } catch (error) {
    return fail(event, 500, 'write_failed', 'Не удалось записать отчёт прогона', String(error));
  }
});
