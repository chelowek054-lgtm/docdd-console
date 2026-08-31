import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { analyze } from '../../../../lib/analyze';
import { dropCache } from '../../../../lib/cache';
import { checkRow, targetPath, withFrontMatter, type PlanRow, type SkippedRow } from '../../../../lib/import';
import { OutsideRootError, normalizeRoot, resolveInside } from '../../../../lib/paths';
import { isRecordType, nextId } from '../../../../lib/scaffold';
import type { RecordType } from '../../../../lib/types';
import { DEVELOPMENT_DIR, WorkspaceError, readWorkspace } from '../../../../lib/workspace';
import { fail } from '../../../../utils/http';
import { findProject } from '../../../../utils/projects';
import { today } from '../../../../utils/record-write';

/**
 * Применение плана, который человек уже поправил. Текст документа не меняется:
 * добавляется front matter и файл переезжает в папку своего раздела.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const body = await readBody<{ rows?: unknown }>(event);
  const rows = Array.isArray(body?.rows) ? (body.rows as PlanRow[]) : [];
  if (rows.length === 0) {
    return fail(event, 400, 'plan_empty', 'В плане нет ни одной строки');
  }

  try {
    const root = normalizeRoot(project.root);
    const workspace = readWorkspace(root);
    const analysis = analyze({ files: workspace.files, manifest: workspace.manifest });

    // Номера выдаются подряд и не переиспользуются, поэтому занятые копим по ходу.
    const taken = new Set(analysis.records.map((record) => record.id));
    const moved: { from: string; to: string; id: string }[] = [];
    const skipped: SkippedRow[] = [];

    for (const row of rows) {
      const from = resolveInside(root, row.path);
      if (!existsSync(from)) {
        skipped.push({ path: row.path, reason: 'Файла больше нет: обзор устарел' });
        continue;
      }

      const text = readFileSync(from, 'utf8');
      const problem = checkRow(row, text);
      if (problem || !isRecordType(row.type)) {
        skipped.push({ path: row.path, reason: problem ?? `Тип \`${row.type}\` не из списка контракта` });
        continue;
      }

      const type: RecordType = row.type;
      const recordId = nextId(type, taken);
      taken.add(recordId);

      const relative = targetPath(DEVELOPMENT_DIR, workspace.manifest.paths ?? {}, type, recordId, row.title);
      const to = resolveInside(root, relative);
      if (existsSync(to)) {
        skipped.push({ path: row.path, reason: `По пути \`${relative}\` уже есть файл` });
        continue;
      }

      mkdirSync(dirname(to), { recursive: true });
      // Сначала переносим, потом дописываем заголовок: так между двумя шагами
      // нет мгновения, когда файл существует в двух местах.
      renameSync(from, to);
      writeFileSync(to, withFrontMatter(text, { id: recordId, type, title: row.title, today: today() }), 'utf8');
      moved.push({ from: row.path, to: relative, id: recordId });
    }

    dropCache(root);
    return { moved, skipped };
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'import_failed', 'Не удалось применить план', String(error));
  }
});
