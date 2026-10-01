import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { analyze } from '../../../../lib/analyze';
import { dropCache } from '../../../../lib/cache';
import {
  drawableRelations,
  isImplStatus,
  isRelationType,
  statusDeclarations,
  type StatusItem
} from '../../../../lib/functional';
import { targetPath } from '../../../../lib/import';
import { mapDraftText, type MapChange } from '../../../../lib/maps';
import { OutsideRootError, normalizeRoot, resolveInside } from '../../../../lib/paths';
import { nextId } from '../../../../lib/scaffold';
import { validateFunctional } from '../../../../lib/schema';
import { DEVELOPMENT_DIR, WorkspaceError, readWorkspace } from '../../../../lib/workspace';
import { fail, failWith } from '../../../../utils/http';
import { loadIndex } from '../../../../utils/index-service';
import { buildProjectMap } from '../../../../utils/map-service';
import { findProject } from '../../../../utils/projects';
import { today } from '../../../../utils/record-write';

/**
 * Правка функциональной карты — без похода к модели: у этого вида нет
 * `evidence`, значит нет и причины требовать модельный ответ ради одного
 * добавления (docs/07-maps.md, «Функциональная карта»). Каждое действие
 * заводит новый черновик карты тем же `mapDraftText`, что и черновик от
 * модели, — не правит тело уже подтверждённой записи в обход человека
 * (docs/adr/0011-body-editing.md).
 *
 * Действия: `add`, `remove` — возможность; `status` — отметки состояния
 * пачкой, в одну запись; `relate`, `unrelate` — связь между возможностями.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const body = await readBody<{ action?: unknown; capability?: unknown; statuses?: unknown; relation?: unknown }>(event);
  const action = typeof body?.action === 'string' ? body.action : 'add';

  let change: MapChange;
  let title: string;

  if (action === 'status') {
    const items = asStatusItems(body?.statuses);
    if (!items) {
      return fail(event, 400, 'capability_invalid', 'Нужен непустой список `statuses`: у каждого `id`, `status` (или `null`) и необязательная `note`');
    }
    const current = buildProjectMap(normalizeRoot(project.root)).functional.capabilities;
    const { declarations, unknown } = statusDeclarations(current, items);
    if (unknown.length > 0) {
      return failWith(
        event,
        422,
        'capability_unknown',
        'В картине нет возможностей, которым ставят состояние; ничего не записано',
        unknown.map((unknownId) => ({ code: 'capability_unknown', message: `Нет возможности \`${unknownId}\`` }))
      );
    }
    change = { functional: { added: { capabilities: declarations } } };
    title = `Функциональная карта: отметки состояния (${declarations.length})`;
  } else if (action === 'relate' || action === 'unrelate') {
    const relation = asRelation(body?.relation);
    if (!relation) {
      return fail(event, 400, 'relation_invalid', 'Нужна связь: `from`, `to` и `type` — `depends`, `uses` или `feeds`');
    }
    if (action === 'relate') {
      const capabilities = buildProjectMap(normalizeRoot(project.root)).functional.capabilities;
      if (drawableRelations([relation], capabilities).drawn.length === 0) {
        return fail(
          event,
          422,
          'relation_invalid',
          'Концы связи — две разные существующие возможности, и не предок с потомком: это уже сказано деревом'
        );
      }
    }
    const part = { relations: [action === 'relate' ? relation : { from: relation.from, to: relation.to, type: relation.type }] };
    const issues = validateFunctional(action === 'relate' ? { added: part } : { removed: part });
    if (issues.length > 0) {
      return failWith(
        event,
        422,
        'relation_invalid',
        'Связь не прошла схему',
        issues.map((issue) => ({ code: 'functional', message: issue.message }))
      );
    }
    change = { functional: action === 'relate' ? { added: part } : { removed: part } };
    title = action === 'relate'
      ? `Функциональная карта: «${relation.from}» → «${relation.to}» (${relation.type})`
      : `Функциональная карта: убрана связь «${relation.from}» → «${relation.to}»`;
  } else {
    const remove = action === 'remove';
    const capability = asCapability(body?.capability);
    if (!capability) {
      return fail(event, 400, 'capability_invalid', 'Нужен `id` возможности — непустая строка');
    }

    const part = { capabilities: [remove ? { id: capability.id } : capability] };
    const issues = validateFunctional(remove ? { removed: part } : { added: part });
    if (issues.length > 0) {
      return failWith(
        event,
        422,
        'capability_invalid',
        'Возможность не прошла схему',
        issues.map((issue) => ({ code: 'functional', message: issue.message }))
      );
    }
    // Значение `status` схема уже проверила выше — приведение типа ничего не пропускает.
    change = (remove ? { functional: { removed: part } } : { functional: { added: part } }) as MapChange;
    title = remove
      ? `Функциональная карта: убрана «${capability.id}»`
      : `Функциональная карта: «${capability.title ?? capability.id}»`;
  }

  try {
    const root = normalizeRoot(project.root);
    const workspace = readWorkspace(root);
    const analysis = analyze({ files: workspace.files, manifest: workspace.manifest });

    const recordId = nextId('map', analysis.records.map((record) => record.id));
    const relative = targetPath(DEVELOPMENT_DIR, workspace.manifest.paths ?? {}, 'map', recordId, title);
    const absolute = resolveInside(root, relative);
    if (existsSync(absolute)) {
      return fail(event, 409, 'record_exists', `По пути \`${relative}\` уже есть файл`);
    }

    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, mapDraftText(recordId, title, change, ['functional'], today()), 'utf8');
    dropCache(root);

    const index = loadIndex(root, true);
    return { record: index.records.find((item) => item.id === recordId), path: relative };
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'capability_failed', 'Не удалось сохранить возможность', String(error));
  }
});

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asCapability(value: unknown): {
  id: string; title?: string; parent?: string; summary?: string; status?: string; note?: string;
} | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const id = text(raw['id']);
  if (!id) return null;
  // Незнакомое значение состояния не отбрасываем молча: схема его отвергнет и назовёт причину.
  const status = text(raw['status']);
  return {
    id,
    ...(text(raw['title']) ? { title: text(raw['title']) as string } : {}),
    ...(text(raw['parent']) ? { parent: text(raw['parent']) as string } : {}),
    ...(text(raw['summary']) ? { summary: text(raw['summary']) as string } : {}),
    ...(status ? { status } : {}),
    ...(text(raw['note']) ? { note: text(raw['note']) as string } : {})
  };
}

function asStatusItems(value: unknown): StatusItem[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const items: StatusItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return null;
    const entry = raw as Record<string, unknown>;
    const id = text(entry['id']);
    const status = entry['status'];
    if (!id || (status !== null && !isImplStatus(status))) return null;
    items.push({
      id,
      status: status === null ? null : (status as StatusItem['status']),
      ...(typeof entry['note'] === 'string' ? { note: entry['note'] } : {})
    });
  }
  return items;
}

function asRelation(value: unknown): { from: string; to: string; type: 'depends' | 'uses' | 'feeds'; summary?: string } | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const from = text(raw['from']);
  const to = text(raw['to']);
  const type = raw['type'];
  if (!from || !to || !isRelationType(type)) return null;
  const summary = text(raw['summary']);
  return { from, to, type, ...(summary ? { summary } : {}) };
}
