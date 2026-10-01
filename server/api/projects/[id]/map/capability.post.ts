import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { defineEventHandler, getRouterParam, readBody, type H3Event } from 'h3';

import { analyze } from '../../../../lib/analyze';
import { dropCache } from '../../../../lib/cache';
import { applyMarks, cleanItem, isCapabilityStatus, type CapabilityItem, type Mark } from '../../../../lib/functional';
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
 * Одна возможность функциональной карты — без похода к модели: у этого вида
 * нет `evidence`, значит нет и причины требовать модельный ответ ради одного
 * добавления (docs/07-maps.md, «Функциональная карта»). Каждое действие
 * заводит новый черновик карты тем же `mapDraftText`, что и черновик от
 * модели, — не правит тело уже подтверждённой записи в обход человека
 * (docs/adr/0011-body-editing.md).
 *
 * Действия: `add` и `remove` — одна возможность; `status` — состояние
 * реализации пачкой (docs/03-server-api.md, `map/capability`).
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const body = await readBody<{ action?: unknown; capability?: unknown; marks?: unknown }>(event);

  if (body?.action === 'status') return saveMarks(event, project.root, body.marks);

  const remove = body?.action === 'remove';
  const capability = asCapability(body?.capability);
  if (!capability) {
    return fail(event, 400, 'capability_invalid', 'Нужен `id` возможности — непустая строка');
  }

  const part = { capabilities: [remove ? { id: capability.id } : capability] };
  const invalid = invalidPart(event, remove ? { removed: part } : { added: part });
  if (invalid) return invalid;

  const change: MapChange = remove ? { functional: { removed: part } } : { functional: { added: part } };
  const title = remove
    ? `Функциональная карта: убрана «${capability.id}»`
    : `Функциональная карта: «${capability.title ?? capability.id}»`;

  return writeDraft(event, project.root, change, title);
});

/**
 * Пачка отметок — один черновик на все. Отметка повторно объявляет
 * возможность, а повторное объявление заменяет элемент целиком, поэтому поля
 * берутся из сложенной карты (`applyMarks`). Неизвестный `id` — отказ всей
 * пачки: принимать половину значит оставить человека гадать, что из отмеченного
 * записалось.
 */
async function saveMarks(event: H3Event, root: string, raw: unknown) {
  const marks = asMarks(raw);
  if (!marks) {
    return fail(
      event,
      400,
      'marks_invalid',
      'Нужен непустой список `marks`: у каждой отметки `id`, а `status` — одно из implemented, partial, not_implemented или null'
    );
  }

  let current;
  try {
    current = buildProjectMap(normalizeRoot(root)).functional.capabilities;
  } catch (error) {
    return failureOf(event, error);
  }

  const { items, unknown } = applyMarks(current, marks);
  if (unknown.length > 0) {
    return fail(
      event,
      422,
      'capability_unknown',
      `В подтверждённой функциональной карте нет возможностей: ${unknown.map((item) => `\`${item}\``).join(', ')}`,
      unknown.join(', ')
    );
  }

  const part = { capabilities: items };
  const invalid = invalidPart(event, { added: part });
  if (invalid) return invalid;

  const title = `Функциональная карта: состояние реализации (${items.length})`;
  return writeDraft(event, root, { functional: { added: part } }, title);
}

function invalidPart(event: H3Event, data: unknown) {
  const issues = validateFunctional(data);
  if (issues.length === 0) return null;
  return failWith(
    event,
    422,
    'capability_invalid',
    'Возможность не прошла схему',
    issues.map((issue) => ({ code: 'functional', message: issue.message }))
  );
}

function writeDraft(event: H3Event, root: string, change: MapChange, title: string) {
  try {
    const normalized = normalizeRoot(root);
    const workspace = readWorkspace(normalized);
    const analysis = analyze({ files: workspace.files, manifest: workspace.manifest });

    const recordId = nextId('map', analysis.records.map((record) => record.id));
    const relative = targetPath(DEVELOPMENT_DIR, workspace.manifest.paths ?? {}, 'map', recordId, title);
    const absolute = resolveInside(normalized, relative);
    if (existsSync(absolute)) {
      return fail(event, 409, 'record_exists', `По пути \`${relative}\` уже есть файл`);
    }

    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, mapDraftText(recordId, title, change, ['functional'], today()), 'utf8');
    dropCache(normalized);

    const index = loadIndex(normalized, true);
    return { record: index.records.find((item) => item.id === recordId), path: relative };
  } catch (error) {
    return failureOf(event, error);
  }
}

function failureOf(event: H3Event, error: unknown) {
  if (error instanceof OutsideRootError) {
    return fail(event, 403, 'outside_root', error.message, error.requested);
  }
  if (error instanceof WorkspaceError) {
    return fail(event, 422, error.code, error.message, error.detail);
  }
  return fail(event, 500, 'capability_failed', 'Не удалось сохранить возможность', String(error));
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * `status` и `note` едут вместе с названием: переименование — повторное
 * объявление, и без них оно молча сняло бы отметку.
 */
function asCapability(value: unknown): CapabilityItem | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const id = text(raw['id']);
  if (!id) return null;
  return cleanItem({
    id,
    title: text(raw['title']),
    parent: text(raw['parent']),
    summary: text(raw['summary']),
    status: isCapabilityStatus(raw['status']) ? raw['status'] : undefined,
    note: text(raw['note'])
  });
}

function asMarks(value: unknown): Mark[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const marks: Mark[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') return null;
    const raw = entry as Record<string, unknown>;
    const id = text(raw['id']);
    if (!id) return null;
    const status = raw['status'];
    if (status !== null && !isCapabilityStatus(status)) return null;
    const mark: Mark = { id, status };
    if (typeof raw['note'] === 'string') mark.note = raw['note'];
    marks.push(mark);
  }
  return marks;
}
