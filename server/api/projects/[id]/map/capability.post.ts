import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { analyze } from '../../../../lib/analyze';
import { dropCache } from '../../../../lib/cache';
import { targetPath } from '../../../../lib/import';
import { mapDraftText, type MapChange } from '../../../../lib/maps';
import { OutsideRootError, normalizeRoot, resolveInside } from '../../../../lib/paths';
import { nextId } from '../../../../lib/scaffold';
import { validateFunctional } from '../../../../lib/schema';
import { DEVELOPMENT_DIR, WorkspaceError, readWorkspace } from '../../../../lib/workspace';
import { fail, failWith } from '../../../../utils/http';
import { loadIndex } from '../../../../utils/index-service';
import { findProject } from '../../../../utils/projects';
import { today } from '../../../../utils/record-write';

/**
 * Одна возможность функциональной карты — без похода к модели: у этого вида
 * нет `evidence`, значит нет и причины требовать модельный ответ ради одного
 * добавления (docs/07-maps.md, «Функциональная карта»). Каждое действие
 * заводит новый черновик карты тем же `mapDraftText`, что и черновик от
 * модели, — не правит тело уже подтверждённой записи в обход человека
 * (docs/adr/0011-body-editing.md).
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const body = await readBody<{ action?: unknown; capability?: unknown }>(event);
  const remove = body?.action === 'remove';
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

  const change: MapChange = remove ? { functional: { removed: part } } : { functional: { added: part } };
  const title = remove
    ? `Функциональная карта: убрана «${capability.id}»`
    : `Функциональная карта: «${capability.title ?? capability.id}»`;

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

function asCapability(value: unknown): { id: string; title?: string; parent?: string; summary?: string } | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const id = typeof raw['id'] === 'string' ? (raw['id'] as string).trim() : '';
  if (!id) return null;
  const title = typeof raw['title'] === 'string' && (raw['title'] as string).trim() ? (raw['title'] as string).trim() : undefined;
  const parent = typeof raw['parent'] === 'string' && (raw['parent'] as string).trim() ? (raw['parent'] as string).trim() : undefined;
  const summary = typeof raw['summary'] === 'string' && (raw['summary'] as string).trim() ? (raw['summary'] as string).trim() : undefined;
  return { id, title, parent, summary };
}
