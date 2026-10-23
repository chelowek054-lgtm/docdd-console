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
 * `relate`, `unrelate` — связь; `relations` — связи пачкой; `status` — отметки
 * состояния пачкой.
 *
 * Тело принимается и в форме `…/map/capability` (`capability` вместо `node`,
 * `statuses` списком с примечаниями): карту рисует то же дерево, что
 * стратегическую (ADR-0028, п. 3), и оно шлёт свою форму.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const mapId = getRouterParam(event, 'mapId') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const body = await readBody<{
    action?: unknown; node?: unknown; capability?: unknown; relation?: unknown; statuses?: unknown; add?: unknown; remove?: unknown;
  }>(event);
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
      const node = asNode(body?.node ?? body?.capability);
      if (!node) return fail(event, 400, 'node_invalid', 'Нужен `node` с непустым `id`');
      // Узел в своде заменяется целиком, а форма дерева ссылок не знает: без этого правка названия стёрла бы их.
      const before = current().find((item) => item.id === node.id);
      if (action === 'add' && !node.links && before?.links) node.links = before.links;
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
    } else if (action === 'relations') {
      // Пачка связей, как у дерева стратегической карты: десять связей — одна запись.
      const add = Array.isArray(body?.add) ? body.add.map(asRelation) : [];
      const remove = Array.isArray(body?.remove) ? body.remove.map(asRelation) : [];
      if (add.length + remove.length === 0 || [...add, ...remove].some((item) => !item)) {
        return fail(event, 400, 'relation_invalid', 'Нужны `add` или `remove`: связи с `from`, `to` и `type`');
      }
      const all = [...add, ...remove] as RelationInput[];
      const foreign = all.filter((item) => !def.relations.some((kind) => kind.id === item.type));
      if (foreign.length > 0) {
        return fail(event, 422, 'relation_invalid', `Вида связи \`${foreign[0]?.type}\` у карты нет; можно: ${def.relations.map((kind) => kind.id).join(', ')}`);
      }
      const ids = new Set(current().map((node) => node.id));
      if ((add as RelationInput[]).some((item) => item.from === item.to || !ids.has(item.from) || !ids.has(item.to))) {
        return fail(event, 422, 'relation_invalid', 'Концы связи — два разных существующих узла этой карты');
      }
      change = {
        map: mapId,
        ...(add.length ? { added: { relations: (add as RelationInput[]).map((item) => ({ map: mapId, ...item })) } } : {}),
        ...(remove.length
          ? { removed: { relations: (remove as RelationInput[]).map((item) => ({ map: mapId, from: item.from, to: item.to, type: item.type })) } }
          : {})
      };
      title = `${def.title}: связи (+${add.length} −${remove.length})`;
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
      const nodes = Object.entries(statuses).map(([nodeId, mark]): CustomNode => {
        const { declaredBy: _by, pending: _pending, status: _old, note: oldNote, ...rest } = known.get(nodeId) as CustomNode;
        // Примечание поясняет состояние: без состояния ему не к чему относиться.
        const note = mark.note !== undefined ? mark.note : oldNote;
        return { ...rest, ...(mark.status ? { status: mark.status, ...(note ? { note } : {}) } : {}) };
      });
      change = { map: mapId, added: { nodes } };
      title = `${def.title}: отметки состояния (${nodes.length})`;
    } else {
      return fail(event, 400, 'action_invalid', 'Действие: `add`, `remove`, `relate`, `unrelate`, `relations` или `status`');
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

interface StatusMark { status: CustomNode['status'] | null; note?: string | undefined }

/**
 * Отметки: `{ id: состояние или null }` или списком `[{ id, status, note? }]` —
 * так их шлёт дерево стратегической карты.
 */
function asStatuses(value: unknown): Record<string, StatusMark> | null {
  if (!value || typeof value !== 'object') return null;
  const entries: [string, unknown, unknown][] = Array.isArray(value)
    ? value.map((item) => {
      const raw = (item ?? {}) as Record<string, unknown>;
      return [typeof raw['id'] === 'string' ? raw['id'] : '', raw['status'] ?? null, raw['note']];
    })
    : Object.entries(value as Record<string, unknown>).map(([nodeId, status]) => [nodeId, status, undefined]);
  if (entries.length === 0) return null;
  const out: Record<string, StatusMark> = {};
  for (const [nodeId, status, note] of entries) {
    if (!nodeId || (status !== null && !isImplStatus(status))) return null;
    if (note !== undefined && typeof note !== 'string') return null;
    out[nodeId] = { status: status as CustomNode['status'] | null, ...(note !== undefined ? { note: note.trim() } : {}) };
  }
  return out;
}
