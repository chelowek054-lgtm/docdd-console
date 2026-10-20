import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { analyze } from '../../../../../../lib/analyze';
import { dropCache } from '../../../../../../lib/cache';
import { customDefinitions, customDraftText } from '../../../../../../lib/custom-maps';
import { isImplStatus } from '../../../../../../lib/functional';
import { targetPath } from '../../../../../../lib/import';
import type { CustomChange, CustomNode, CustomRelation } from '../../../../../../lib/maps';
import { OutsideRootError, normalizeRoot, resolveInside } from '../../../../../../lib/paths';
import { nextId } from '../../../../../../lib/scaffold';
import { validateCustom } from '../../../../../../lib/schema';
import { DEVELOPMENT_DIR, WorkspaceError, readWorkspace } from '../../../../../../lib/workspace';
import { fail, failWith } from '../../../../../../utils/http';
import { loadIndex } from '../../../../../../utils/index-service';
import { buildProjectMap } from '../../../../../../utils/map-service';
import { findProject } from '../../../../../../utils/projects';
import { today } from '../../../../../../utils/record-write';

type NodeInput = Omit<CustomNode, 'map'>;
type RelationInput = Omit<CustomRelation, 'map'>;

/**
 * Правка пользовательской карты (docs/adr/0028-custom-maps.md) — как
 * `POST …/map/capability`: каждое действие заводит новый черновик записи `map`
 * с блоком `docdd-custom`, тело подтверждённых записей не трогается
 * (docs/adr/0011-body-editing.md). Действия: `add`, `remove` — узел;
 * `relate`, `unrelate` — связь; `status` — отметки состояния пачкой.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const mapId = getRouterParam(event, 'mapId') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const body = await readBody<{ action?: unknown; node?: unknown; relation?: unknown; statuses?: unknown }>(event);
  const action = typeof body?.action === 'string' ? body.action : 'add';

  try {
    const root = normalizeRoot(project.root);
    const workspace = readWorkspace(root);
    const def = customDefinitions(workspace.manifest).definitions.find((item) => item.id === mapId);
    if (!def) {
      return fail(event, 404, 'custom_map_not_found', `Карты \`${mapId}\` нет среди определений манифеста`);
    }
    const current = () => buildProjectMap(root).custom.nodes.filter((node) => node.map === mapId);

    let change: CustomChange;
    let title: string;

    if (action === 'add' || action === 'remove') {
      const node = asNode(body?.node);
      if (!node) return fail(event, 400, 'node_invalid', 'Нужен `node` с непустым `id`');
      change = action === 'add'
        ? { map: mapId, added: { nodes: [{ map: mapId, ...node }] } }
        : { map: mapId, removed: { nodes: [{ map: mapId, id: node.id }] } };
      title = action === 'add'
        ? `${def.title}: «${node.title ?? node.id}»`
        : `${def.title}: убран «${node.id}»`;
    } else if (action === 'relate' || action === 'unrelate') {
      const relation = asRelation(body?.relation);
      if (!relation) return fail(event, 400, 'relation_invalid', 'Нужна связь: `from`, `to` и `type`');
      if (!def.relations.some((kind) => kind.id === relation.type)) {
        return fail(event, 422, 'relation_invalid', `Вида связи \`${relation.type}\` у карты нет; можно: ${def.relations.map((kind) => kind.id).join(', ')}`);
      }
      if (action === 'relate') {
        const ids = new Set(current().map((node) => node.id));
        if (relation.from === relation.to || !ids.has(relation.from) || !ids.has(relation.to)) {
          return fail(event, 422, 'relation_invalid', 'Концы связи — два разных существующих узла этой карты');
        }
      }
      change = action === 'relate'
        ? { map: mapId, added: { relations: [{ map: mapId, ...relation }] } }
        : { map: mapId, removed: { relations: [{ map: mapId, from: relation.from, to: relation.to, type: relation.type }] } };
      title = action === 'relate'
        ? `${def.title}: «${relation.from}» → «${relation.to}» (${relation.type})`
        : `${def.title}: убрана связь «${relation.from}» → «${relation.to}»`;
    } else if (action === 'status') {
      if (!def.features.includes('status')) {
        return fail(event, 422, 'feature_disabled', `У карты \`${mapId}\` не включено состояние узлов`);
      }
      const statuses = asStatuses(body?.statuses);
      if (!statuses) return fail(event, 400, 'node_invalid', 'Нужен непустой `statuses`: { id: состояние или null }');
      // Узел в своде заменяется целиком по ключу — переобъявляем его полностью, меняя только состояние.
      const known = new Map(current().map((node) => [node.id, node]));
      const unknown = Object.keys(statuses).filter((nodeId) => !known.has(nodeId));
      if (unknown.length > 0) {
        return failWith(event, 422, 'node_unknown', 'В картине нет узлов, которым ставят состояние; ничего не записано',
          unknown.map((nodeId) => ({ code: 'node_unknown', message: `Нет узла \`${nodeId}\`` })));
      }
      const nodes = Object.entries(statuses).map(([nodeId, status]): CustomNode => {
        const { declaredBy: _by, pending: _pending, status: _old, ...rest } = known.get(nodeId) as CustomNode;
        return { ...rest, ...(status ? { status } : {}) };
      });
      change = { map: mapId, added: { nodes } };
      title = `${def.title}: отметки состояния (${nodes.length})`;
    } else {
      return fail(event, 400, 'action_invalid', 'Действие: `add`, `remove`, `relate`, `unrelate` или `status`');
    }

    const issues = validateCustom(change);
    if (issues.length > 0) {
      return failWith(event, 422, 'node_invalid', 'Правка не прошла схему', issues.map((issue) => ({ code: 'custom', message: issue.message })));
    }

    const analysis = analyze({ files: workspace.files, manifest: workspace.manifest });
    const recordId = nextId('map', analysis.records.map((record) => record.id));
    const relative = targetPath(DEVELOPMENT_DIR, workspace.manifest.paths ?? {}, 'map', recordId, title);
    const absolute = resolveInside(root, relative);
    if (existsSync(absolute)) {
      return fail(event, 409, 'record_exists', `По пути \`${relative}\` уже есть файл`);
    }

    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, customDraftText(recordId, title, change, today()), 'utf8');
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
    return fail(event, 500, 'custom_node_failed', 'Не удалось сохранить правку карты', String(error));
  }
});

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Узел из тела; незнакомое значение состояния и прочего не отбрасываем — схема назовёт причину. */
function asNode(value: unknown): NodeInput | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const id = text(raw['id']);
  if (!id) return null;
  const node: Record<string, unknown> = { id };
  for (const key of ['title', 'parent', 'summary', 'status', 'note', 'priority', 'horizon'] as const) {
    const item = text(raw[key]);
    if (item) node[key] = item;
  }
  if (raw['links'] && typeof raw['links'] === 'object') node['links'] = raw['links'];
  return node as unknown as NodeInput;
}

function asRelation(value: unknown): RelationInput | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const from = text(raw['from']);
  const to = text(raw['to']);
  const type = text(raw['type']);
  if (!from || !to || !type) return null;
  const summary = text(raw['summary']);
  const evidence = raw['evidence'] && typeof raw['evidence'] === 'object' ? (raw['evidence'] as CustomRelation['evidence']) : undefined;
  return { from, to, type, ...(summary ? { summary } : {}), ...(evidence ? { evidence } : {}) };
}

function asStatuses(value: unknown): Record<string, CustomNode['status'] | null> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return null;
  const out: Record<string, CustomNode['status'] | null> = {};
  for (const [nodeId, status] of entries) {
    if (status !== null && !isImplStatus(status)) return null;
    out[nodeId] = status as CustomNode['status'] | null;
  }
  return out;
}
