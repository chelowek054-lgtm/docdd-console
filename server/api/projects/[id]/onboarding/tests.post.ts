import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { OutsideRootError } from '../../../../lib/paths';
import { fail } from '../../../../utils/http';
import { findProject } from '../../../../utils/projects';
import { connectReport, createTestChecks } from '../../../../utils/test-checks-service';

/**
 * `{ files?: string[] }` — завести проверки-черновики по найденным тестам (все сопоставленные или названные);
 * `{ report: "путь" }` — подключить отчёт сборки раннера (JSON vitest/jest или JUnit-XML) и записать его в `tests/reports` (R-0079).
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  const body = (await readBody<{ files?: unknown; report?: unknown }>(event)) ?? {};
  try {
    if (typeof body.report === 'string' && body.report.trim()) {
      const outcome = connectReport(project.root, body.report.trim());
      return outcome.ok ? outcome : fail(event, outcome.code === 'report_not_found' ? 404 : 422, outcome.code, outcome.message);
    }
    const only = Array.isArray(body.files) ? body.files.filter((item): item is string => typeof item === 'string') : undefined;
    const outcome = createTestChecks(project.root, only);
    return outcome.ok ? outcome : fail(event, 409, outcome.code, outcome.message);
  } catch (error) {
    if (error instanceof OutsideRootError) return fail(event, 403, 'outside_root', error.message, error.requested);
    return fail(event, 500, 'tests_failed', 'Не удалось выполнить', String(error));
  }
});
