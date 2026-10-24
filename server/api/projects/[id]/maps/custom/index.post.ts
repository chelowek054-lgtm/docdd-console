import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { defineEventHandler, getRouterParam, readBody, type H3Event } from 'h3';
import { load } from 'js-yaml';

import { dropCache } from '../../../../../lib/cache';
import { ENGINE_TEMPLATES, customDefinitions, declaredEngines, isEngineTemplate } from '../../../../../lib/custom-maps';
import { appendCustomMap } from '../../../../../lib/manifest-write';
import { OutsideRootError, normalizeRoot, resolveInside } from '../../../../../lib/paths';
import { DEVELOPMENT_DIR, MANIFEST_FILE, WorkspaceError, readWorkspace } from '../../../../../lib/workspace';
import { fail, failWith } from '../../../../../utils/http';
import { whoIs } from '../../../../../utils/job-feeds';
import { findProject } from '../../../../../utils/projects';

/**
 * Новое определение пользовательской карты (docs/adr/0028-custom-maps.md).
 * Определение — настройка проекта, а не утверждение о нём, поэтому пишется
 * прямо в `project.yaml`, без черновика записи. Файл правится точечно
 * (server/lib/manifest-write.ts): незнакомые поля и комментарии человека целы.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const body = await readBody<Record<string, unknown>>(event);
  // Шаблон с движком (ADR-0035): без формы, строка `maps.custom` с `template`.
  if (body && typeof body === 'object' && body['template'] !== undefined) {
    return createEngineMap(event, project.root, body['template'], whoIs(event).user);
  }
  const parsed = asDefinition(body);
  // Кто завёл — удалить сможет он или администратор (ADR-0036).
  const definition: Record<string, unknown> | null = parsed ? { ...parsed, by: whoIs(event).user } : null;
  if (!definition) {
    return fail(event, 400, 'custom_map_invalid', 'Нужен объект определения: `id`, `title`, `node` {label, plural}, `features`');
  }

  try {
    const root = normalizeRoot(project.root);
    const manifest = readWorkspace(root).manifest;
    const existing = Array.isArray(manifest.maps?.custom) ? manifest.maps.custom : [];
    if (manifest.maps?.custom !== undefined && !Array.isArray(manifest.maps.custom)) {
      return fail(event, 422, 'custom_map_invalid', '`maps.custom` в манифесте — не список; поправьте вручную');
    }
    if (existing.some((item) => (item as { id?: unknown } | null)?.id === definition['id'])) {
      return fail(event, 409, 'custom_map_exists', `Карта \`${String(definition['id'])}\` уже объявлена`);
    }

    // Проверяем тем же отбором, что читает манифест; беды чужих определений не наши.
    const at = existing.length;
    const { definitions, problems } = customDefinitions({ maps: { ...manifest.maps, custom: [...existing, definition] } });
    const own = problems.filter((problem) => problem.startsWith(`maps.custom[${at}]`));
    const accepted = definitions.find((item) => item.id === definition['id']);
    if (own.length > 0 || !accepted) {
      return failWith(event, 422, 'custom_map_invalid', 'Определение не прошло проверку', own.map((message) => ({ code: 'custom_map', message })));
    }

    const manifestPath = resolveInside(root, join(DEVELOPMENT_DIR, MANIFEST_FILE));
    const text = readFileSync(manifestPath, 'utf8');
    const edit = appendCustomMap(text, definition);
    if (!edit.ok) {
      return fail(event, 422, 'manifest_form', edit.message);
    }
    // Построчная правка не разбирает YAML — сверяем результат, прежде чем писать файл человека.
    const reread = load(edit.text) as { maps?: { custom?: unknown } } | null;
    const custom = reread?.maps?.custom;
    if (!Array.isArray(custom) || custom.length !== at + 1 || (custom[at] as { id?: unknown })?.id !== definition['id']) {
      return fail(event, 422, 'manifest_form', 'Не удалось точечно дописать `maps.custom`: форма секции непривычная — допишите карту вручную');
    }

    writeFileSync(manifestPath, edit.text, 'utf8');
    dropCache(root);
    return { definition: accepted };
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'custom_map_failed', 'Не удалось сохранить определение карты', String(error));
  }
});

/** Только поля определения из тела; лишнее в манифест не тащим. Пустые необязательные — отбрасываем. */
function asDefinition(body: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const trim = (value: unknown) => (typeof value === 'string' ? value.trim() : value);
  const summary = trim(body['summary']);
  const node = body['node'] as Record<string, unknown> | undefined;
  return {
    id: trim(body['id']),
    title: trim(body['title']),
    ...(summary !== undefined && summary !== '' ? { summary } : {}),
    node: node && typeof node === 'object' ? { label: trim(node['label']), plural: trim(node['plural']) } : node,
    ...(body['relations'] !== undefined ? { relations: body['relations'] } : {}),
    features: body['features'] ?? []
  };
}

/** Заводит рабочую карту из шаблона с движком: одна на проект, `id` равен шаблону. */
function createEngineMap(event: H3Event, projectRoot: string, template: unknown, by: string) {
  if (!isEngineTemplate(template)) {
    return fail(event, 400, 'custom_map_invalid', `Шаблон с движком: ${ENGINE_TEMPLATES.join(', ')}`);
  }
  try {
    const root = normalizeRoot(projectRoot);
    const manifest = readWorkspace(root).manifest;
    if (manifest.maps?.custom !== undefined && !Array.isArray(manifest.maps.custom)) {
      return fail(event, 422, 'custom_map_invalid', '`maps.custom` в манифесте — не список; поправьте вручную');
    }
    const existing = Array.isArray(manifest.maps?.custom) ? manifest.maps.custom : [];
    if (existing.some((item) => (item as { id?: unknown } | null)?.id === template)) {
      return fail(event, 409, 'custom_map_exists', `Карта «${template}» уже объявлена`);
    }
    const definition = { id: template, title: ENGINE_TITLE[template], template, by };
    const manifestPath = resolveInside(root, join(DEVELOPMENT_DIR, MANIFEST_FILE));
    const edit = appendCustomMap(readFileSync(manifestPath, 'utf8'), definition);
    if (!edit.ok) return fail(event, 422, 'manifest_form', edit.message);
    // Построчная правка не разбирает YAML — сверяем результат, прежде чем писать файл человека.
    const reread = load(edit.text) as { maps?: { custom?: unknown[] } } | null;
    if (!declaredEngines({ maps: { custom: reread?.maps?.custom ?? [] } }).includes(template)) {
      return fail(event, 422, 'manifest_form', 'Не удалось точечно дописать `maps.custom`: форма секции непривычная — допишите карту вручную');
    }
    writeFileSync(manifestPath, edit.text, 'utf8');
    dropCache(root);
    return { definition };
  } catch (error) {
    if (error instanceof OutsideRootError) return fail(event, 403, 'outside_root', error.message, error.requested);
    if (error instanceof WorkspaceError) return fail(event, 422, error.code, error.message, error.detail);
    return fail(event, 500, 'custom_map_failed', 'Не удалось сохранить определение карты', String(error));
  }
}

const ENGINE_TITLE = { codemap: 'Кодовая база', dataflow: 'Потоки данных', userflow: 'Пользовательские пути' } as const;
