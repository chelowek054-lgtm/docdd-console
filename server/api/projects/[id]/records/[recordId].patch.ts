import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { applyFieldPatch, type PatchFields } from '../../../../lib/actions';
import { OutsideRootError } from '../../../../lib/paths';
import { LINK_KINDS, type LinkKind } from '../../../../lib/types';
import { WorkspaceError } from '../../../../lib/workspace';
import { fail, failWith } from '../../../../utils/http';
import { findProject } from '../../../../utils/projects';
import { openRecord, saveRecord, today } from '../../../../utils/record-write';

/**
 * Правка полей front matter. Тело документа этот маршрут не принимает вовсе —
 * его здесь нет намеренно (docs/03-server-api.md).
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const recordId = getRouterParam(event, 'recordId') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const body = await readBody<Record<string, unknown>>(event);
  const unknown = Object.keys(body ?? {}).filter((key) => !['owner', 'phase', 'tags', 'links'].includes(key));
  if (unknown.length > 0) {
    return fail(
      event,
      400,
      'field_not_editable',
      `Полей \`${unknown.join('`, `')}\` этот маршрут не меняет: правке подлежат owner, phase, tags и links`
    );
  }

  const fields: PatchFields = {};
  if ('owner' in body) fields.owner = asStringOrNull(body['owner']);
  if ('phase' in body) fields.phase = asStringOrNull(body['phase']);
  if ('tags' in body) fields.tags = asStrings(body['tags']);
  if ('links' in body) fields.links = asLinks(body['links']);

  try {
    const context = openRecord(project.root, recordId);
    if (!context) {
      return fail(event, 404, 'record_not_found', `Записи \`${recordId}\` в проекте нет`);
    }

    const outcome = applyFieldPatch(context.original, fields, today());
    const saved = saveRecord(context, outcome, project.root);
    if (!saved.ok) {
      return failWith(
        event,
        422,
        'write_refused',
        'Запись отменена: изменение затронуло бы не только разрешённые поля',
        saved.problems.map((message) => ({ code: 'guard', message }))
      );
    }

    return { record: saved.record };
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'write_failed', 'Не удалось записать изменение', String(error));
  }
});

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asLinks(value: unknown): Partial<Record<LinkKind, string[]>> {
  const links: Partial<Record<LinkKind, string[]>> = {};
  if (value === null || typeof value !== 'object') return links;
  const source = value as Record<string, unknown>;
  for (const kind of LINK_KINDS) {
    if (kind in source) links[kind] = asStrings(source[kind]);
  }
  return links;
}
