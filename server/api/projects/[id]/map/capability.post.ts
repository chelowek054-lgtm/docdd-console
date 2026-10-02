import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { analyze } from '../../../../lib/analyze';
import { dropCache } from '../../../../lib/cache';
import {
  drawableRelations,
  isImplStatus,
  isRelationType,
  planRelations,
  statusDeclarations,
  type RelationItem,
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
 * пачкой, в одну запись; `relate`, `unrelate` — связь между возможностями;
 * `relations` — связи пачкой, в одну запись; `vision` — вектор проекта
 * (docs/07-maps.md, «Вектор проекта»).
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const body = await readBody<{
    action?: unknown; capability?: unknown; statuses?: unknown; relation?: unknown; vision?: unknown;
    add?: unknown; remove?: unknown;
  }>(event);
  const action = typeof body?.action === 'string' ? body.action : 'add';

  let change: MapChange;
  let title: string;
  let skipped: { from: string; to: string; type: string; reason: string }[] = [];

  if (action === 'vision') {
    const vision = asVision(body?.vision);
    if (!vision) {
      return fail(event, 422, 'vision_invalid', 'Вектор проекта: хотя бы одно из полей `problem`, `audience`, `outcome`, `not` должно быть непустым');
    }
    const issues = validateFunctional({ added: { vision } });
    if (issues.length > 0) {
      return failWith(
        event,
        422,
        'vision_invalid',
        'Вектор не прошёл схему',
        issues.map((issue) => ({ code: 'functional', message: issue.message }))
      );
    }
    change = { functional: { added: { vision } } };
    title = 'Функциональная карта: вектор проекта';
  } else if (action === 'status') {
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
  } else if (action === 'relations') {
    const add = asRelationList(body?.add);
    const remove = asRelationList(body?.remove);
    if (!add || !remove || add.length + remove.length === 0) {
      return fail(event, 400, 'relation_invalid', 'Нужны списки `add` и/или `remove`, в них вместе — хотя бы одна связь: `from`, `to` и `type`');
    }
    const { capabilities: current, relations: standing } = buildProjectMap(normalizeRoot(project.root)).functional;
    const plan = planRelations(current, standing, add, remove.map(({ from, to, type }) => ({ from, to, type })));
    if (plan.problems.length > 0) {
      return failWith(
        event,
        422,
        'relation_invalid',
        'В пачке есть связи, которые нельзя завести; ничего не записано',
        plan.problems.map((message) => ({ code: 'relation_invalid', message }))
      );
    }
    if (plan.add.length + plan.remove.length === 0) {
      return failWith(event, 409, 'nothing_to_create', 'Всё из пачки уже так и есть: записывать нечего', plan.skipped.map((item) => ({
        code: 'skipped',
        message: `«${item.from}» → «${item.to}» (${item.type}): ${item.reason}`
      })));
    }
    const parts = {
      ...(plan.add.length ? { added: { relations: plan.add } } : {}),
      ...(plan.remove.length ? { removed: { relations: plan.remove } } : {})
    };
    const issues = validateFunctional(parts);
    if (issues.length > 0) {
      return failWith(
        event,
        422,
        'relation_invalid',
        'Связи не прошли схему',
        issues.map((issue) => ({ code: 'functional', message: issue.message }))
      );
    }
    change = { functional: parts };
    title = `Функциональная карта: связи (+${plan.add.length} −${plan.remove.length})`;
    skipped = plan.skipped;
  } else if (action === 'relate' || action === 'unrelate') {
    const relation = asRelation(body?.relation);
    if (!relation) {
      return fail(event, 400, 'relation_invalid', 'Нужна связь: `from`, `to` и `type` — `depends`, `uses`, `feeds`, `triggers` или `replaces`');
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
    return {
      record: index.records.find((item) => item.id === recordId),
      path: relative,
      ...(skipped.length ? { skipped } : {})
    };
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
  priority?: string; horizon?: string;
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
    ...(text(raw['note']) ? { note: text(raw['note']) as string } : {}),
    // Как и `status`: незнакомое значение схема отвергнет и назовёт причину.
    ...(text(raw['priority']) ? { priority: text(raw['priority']) as string } : {}),
    ...(text(raw['horizon']) ? { horizon: text(raw['horizon']) as string } : {})
  };
}

/** Четыре поля вектора; пустые отбрасываются, нет ни одного — это не вектор. */
function asVision(value: unknown): { problem?: string; audience?: string; outcome?: string; not?: string } | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const vision: { problem?: string; audience?: string; outcome?: string; not?: string } = {};
  for (const key of ['problem', 'audience', 'outcome', 'not'] as const) {
    const text = typeof raw[key] === 'string' ? (raw[key] as string).trim() : '';
    if (text) vision[key] = text;
  }
  return Object.keys(vision).length > 0 ? vision : null;
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

/** Список связей пачки; не список или хоть одна без `from`/`to`/вида — `null`. Пустой список — допустим. */
function asRelationList(value: unknown): RelationItem[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const items: RelationItem[] = [];
  for (const raw of value) {
    const relation = asRelation(raw);
    if (!relation) return null;
    items.push(relation);
  }
  return items;
}

function asRelation(value: unknown): RelationItem | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const from = text(raw['from']);
  const to = text(raw['to']);
  const type = raw['type'];
  if (!from || !to || !isRelationType(type)) return null;
  const summary = text(raw['summary']);
  return { from, to, type, ...(summary ? { summary } : {}) };
}
