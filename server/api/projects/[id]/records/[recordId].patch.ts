import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { applyFieldPatch, type PatchFields } from '../../../../lib/actions';
import { OutsideRootError } from '../../../../lib/paths';
import { LINK_KINDS, type LinkKind } from '../../../../lib/types';
import { WorkspaceError } from '../../../../lib/workspace';
import { fail, failWith } from '../../../../utils/http';
import { findProject } from '../../../../utils/projects';
import { applyJournalNote } from '../../../../lib/actions';
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
  const unknown = Object.keys(body ?? {}).filter((key) => !['owner', 'reviewer', 'phase', 'tags', 'links', 'change', 'reuse', 'assignee', 'actor', 'version'].includes(key));
  if (unknown.length > 0) {
    return fail(
      event,
      400,
      'field_not_editable',
      `Полей \`${unknown.join('`, `')}\` этот маршрут не меняет: правке подлежат owner, reviewer, phase, tags, links, change и reuse`
    );
  }

  const fields: PatchFields = {};
  if ('owner' in body) fields.owner = asStringOrNull(body['owner']);
  if ('reviewer' in body) fields.reviewer = asStringOrNull(body['reviewer']);
  if ('change' in body) fields.change = asStringOrNull(body['change']);
  if ('reuse' in body) fields.reuse = asStringOrNull(body['reuse']);
  if ('assignee' in body) fields.assignee = asStringOrNull(body['assignee']);
  if ('phase' in body) fields.phase = asStringOrNull(body['phase']);
  if ('tags' in body) fields.tags = asStrings(body['tags']);
  if ('links' in body) fields.links = asLinks(body['links']);

  try {
    const context = openRecord(project.root, recordId);
    if (!context) {
      return fail(event, 404, 'record_not_found', `Записи \`${recordId}\` в проекте нет`);
    }

    if (versionConflict(context.record, body?.['version'])) {
      return fail(event, 409, 'record_changed_since_load', 'Запись изменили с тех пор, как вы её открыли: перечитайте и повторите правку');
    }
    // Ревьюер — роль манифеста (adr/0030): незнакомую роль принять некому.
    const roles = context.workspace.manifest.roles ?? [];
    if (fields.reviewer && roles.length > 0 && !roles.some((role) => role.id === fields.reviewer)) {
      return fail(event, 400, 'reviewer_unknown', 'Роли «' + fields.reviewer + '» нет в манифесте проекта');
    }
    if (fields.reviewer !== undefined && context.record.type !== 'task') {
      return fail(event, 400, 'reviewer_not_task', 'Ревьюер назначается только задаче');
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

    // Смена исполнителя — движение работы: строка в журнале (T-0016).
    if (fields.assignee !== undefined && fields.assignee !== (context.record.data['assignee'] ?? null)) {
      const again = openRecord(project.root, recordId);
      if (again) {
        const note = applyJournalNote(again.original, {
          action: fields.assignee ? `исполнитель: ${fields.assignee}` : 'исполнитель снят',
          actor: typeof body['actor'] === 'string' ? body['actor'] : '',
          today: today()
        });
        saveRecord(again, note, project.root);
      }
    }
    notifyPatched(id, recordId, context.record.data, fields); return { record: saved.record };
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
import { versionConflict } from '../../../../lib/version';
import { notifyPatched } from '../../../../utils/notify-events';
