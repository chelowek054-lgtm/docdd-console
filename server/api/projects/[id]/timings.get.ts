import { defineEventHandler, getQuery, getRouterParam, setHeader } from 'h3';

import { OutsideRootError } from '../../../lib/paths';
import { timingsCsv } from '../../../lib/timing';
import { WorkspaceError } from '../../../lib/workspace';
import { fail } from '../../../utils/http';
import { findProject } from '../../../utils/projects';
import { timingsOf } from '../../../utils/timing-service';

/**
 * Тайминги задач из журнала (ADR-0039, docs/03-server-api.md): по задаче, по фазе и
 * сводка «Аналитики». `?format=csv|json` — те же числа файлом.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);

  try {
    const timings = timingsOf(project.root);
    const format = getQuery(event)['format'];
    if (format === 'csv') {
      setHeader(event, 'Content-Type', 'text/csv; charset=utf-8');
      setHeader(event, 'Content-Disposition', `attachment; filename="${id}-timings.csv"`);
      // BOM — чтобы внешняя таблица открыла кириллицу без выбора кодировки.
      return '﻿' + timingsCsv(timings.tasks);
    }
    if (format === 'json') {
      setHeader(event, 'Content-Disposition', `attachment; filename="${id}-timings.json"`);
    }
    return timings;
  } catch (error) {
    if (error instanceof OutsideRootError) return fail(event, 403, 'outside_root', error.message, error.requested);
    if (error instanceof WorkspaceError) return fail(event, 422, error.code, error.message, error.detail);
    return fail(event, 500, 'timings_failed', 'Не удалось посчитать тайминги', String(error));
  }
});
