import { readFileSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';

import { defineEventHandler, getRouterParam } from 'h3';

import { analyze } from '../../../../lib/analyze';
import { extractDiagrams } from '../../../../lib/diagrams';
import { parseRecord } from '../../../../lib/parse';
import { OutsideRootError, resolveInside } from '../../../../lib/paths';
import { availableActions } from '../../../../lib/transitions';
import type { RecordAction, RecordDetail } from '../../../../lib/types';
import { WorkspaceError, readWorkspace } from '../../../../lib/workspace';
import { fail } from '../../../../utils/http';
import { loadIndex } from '../../../../utils/index-service';
import { findProject } from '../../../../utils/projects';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const recordId = getRouterParam(event, 'recordId') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  try {
    const index = loadIndex(project.root);
    const record = index.records.find((item) => item.id === recordId);
    if (!record) {
      return fail(event, 404, 'record_not_found', `Записи \`${recordId}\` в проекте нет`);
    }

    // Тело читается из файла, а не из кэша: документ принадлежит человеку и
    // мог измениться в редакторе между сборками индекса.
    const absolute = resolveInside(project.root, record.path);
    const parsed = parseRecord(readFileSync(absolute, 'utf8'), { path: record.path });
    if (!parsed.ok) {
      return fail(event, 422, parsed.violation.code, parsed.violation.message, record.path);
    }

    const detail: RecordDetail = {
      record,
      body: parsed.record.body,
      eol: parsed.record.eol,
      diagrams: extractDiagrams(parsed.record.body, (relativePath) => readMmd(project.root, record.path, relativePath)),
      actions: actionsFor(project.root, recordId),
      issues: index.issues.filter((issue) => issue.recordId === recordId || issue.path === record.path),
      verifications: verificationsOf(index, record.links.verified_by ?? [])
    };
    return detail;
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'read_failed', 'Не удалось прочитать запись', String(error));
  }
});

/**
 * Действия считаются на живом состоянии проекта, а не на кэше: между сборкой
 * индекса и открытием экрана документ мог получить подтверждение.
 */
function actionsFor(root: string, recordId: string): RecordAction[] {
  const workspace = readWorkspace(root);
  const result = analyze({
    files: workspace.files,
    manifest: workspace.manifest,
    reports: workspace.reports,
    codeFiles: workspace.codeFiles
  });
  const record = result.records.find((item) => item.id === recordId);
  return record ? availableActions(record, result.context) : [];
}

/** Диаграмма из отдельного файла: путь считается от файла записи и не выходит за корень. */
function readMmd(root: string, recordPath: string, relativePath: string): string | null {
  try {
    const target = join(dirname(recordPath), relativePath).replaceAll(sep, '/');
    return readFileSync(resolveInside(root, target), 'utf8');
  } catch {
    return null;
  }
}

function verificationsOf(
  index: { verificationResults: RecordDetail['verifications'] },
  ids: readonly string[]
): RecordDetail['verifications'] {
  const picked: RecordDetail['verifications'] = {};
  for (const id of ids) {
    const outcome = index.verificationResults[id];
    if (outcome) picked[id] = outcome;
  }
  return picked;
}
