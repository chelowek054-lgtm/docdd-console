import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { analyze } from '../../../../lib/analyze';
import { dropCache } from '../../../../lib/cache';
import { targetPath } from '../../../../lib/import';
import { OutsideRootError, normalizeRoot, resolveInside } from '../../../../lib/paths';
import { isRecordType, nextId, recordTemplate } from '../../../../lib/scaffold';
import { LINK_KINDS, type LinkKind, type RecordType } from '../../../../lib/types';
import { DEVELOPMENT_DIR, WorkspaceError, readWorkspace } from '../../../../lib/workspace';
import { fail } from '../../../../utils/http';
import { loadIndex } from '../../../../utils/index-service';
import { findProject } from '../../../../utils/projects';
import { today } from '../../../../utils/record-write';

/**
 * Создание записи из шаблона. Идентификатор выдаёт сервер — следующий
 * свободный: номера не переиспользуются, поэтому выбрать его нельзя.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const body = await readBody<{
    type?: unknown; title?: unknown; owner?: unknown; links?: unknown; kind?: unknown; change?: unknown;
  }>(event);
  const type = typeof body?.type === 'string' ? body.type : '';
  const title = typeof body?.title === 'string' ? body.title.trim() : '';

  if (!isRecordType(type)) {
    return fail(event, 400, 'type_invalid', `Тип \`${type}\` не из списка контракта`);
  }
  if (!title) {
    return fail(event, 400, 'title_required', 'Без заголовка запись не найти в списке');
  }

  try {
    const root = normalizeRoot(project.root);
    const workspace = readWorkspace(root);
    const analysis = analyze({ files: workspace.files, manifest: workspace.manifest });

    const recordType: RecordType = type;
    const recordId = nextId(recordType, analysis.records.map((record) => record.id));
    const relative = targetPath(DEVELOPMENT_DIR, workspace.manifest.paths ?? {}, recordType, recordId, title);
    const absolute = resolveInside(root, relative);

    if (existsSync(absolute)) {
      return fail(event, 409, 'record_exists', `По пути \`${relative}\` уже есть файл`);
    }

    const template = recordTemplate({
      id: recordId,
      type: recordType,
      title,
      today: today(),
      ...(typeof body?.owner === 'string' && body.owner ? { owner: body.owner } : {}),
      ...(typeof body?.kind === 'string' && body.kind ? { kind: body.kind } : {}),
      ...(typeof body?.change === 'string' && body.change ? { change: body.change } : {}),
      links: asLinks(body?.links)
    });

    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, template, 'utf8');
    dropCache(root);

    const index = loadIndex(root, true);
    const record = index.records.find((item) => item.id === recordId);
    return { record, path: relative };
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'create_failed', 'Не удалось создать запись', String(error));
  }
});

function asLinks(value: unknown): Partial<Record<LinkKind, string[]>> {
  const links: Partial<Record<LinkKind, string[]>> = {};
  if (value === null || typeof value !== 'object') return links;
  const source = value as Record<string, unknown>;
  for (const kind of LINK_KINDS) {
    const ids = source[kind];
    if (Array.isArray(ids)) {
      const clean = ids.filter((item): item is string => typeof item === 'string' && item !== '');
      if (clean.length > 0) links[kind] = clean;
    }
  }
  return links;
}
