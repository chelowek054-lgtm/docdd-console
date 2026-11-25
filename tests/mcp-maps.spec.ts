// Карты через MCP (R-0142, V-0152) и линтер пользовательских карт (R-0141, V-0151).
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { lintCustomChange, lintGraph, lintStrategicChange, standardFor } from '../server/lib/map-core';
import { parseMapRecord } from '../server/lib/maps';
import { callTool, createRegistry, loadTools, type ApiClient } from '../server/lib/mcp';
import { analyze, type SourceFile } from '../server/lib/analyze';
import { lintDetails } from '../server/utils/map-lint';

const libDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'server', 'lib');

interface Cap { id: string; title?: string; summary?: string; parent?: string; kind?: string; status?: string }
interface Rel { from: string; to: string; type: string; summary?: string }

/**
 * Консоль в миниатюре: черновик разбирается и проходит линтер тем же кодом, что у маршрута
 * `map/draft`, а подтверждение человеком сведено к немедленному применению — проверяется путь модели.
 */
function consoleStub() {
  const state: { capabilities: Cap[]; relations: Rel[] } = { capabilities: [], relations: [] };
  const drafts: string[] = [];
  const standard = standardFor('strategic', [])?.standard;
  if (!standard) throw new Error('нет стандарта стратегической карты');
  const api: ApiClient = {
    get: async (path) => (path.includes('/map/context?')
      ? { ok: true, status: 200, data: { instructions: 'Назначение узлов обязательно', contextToken: 'map-context', current: state } }
      : path.endsWith('/maps/custom')
      ? { ok: true, status: 200, data: { definitions: [], maps: {} } }
      : { ok: true, status: 200, data: { functional: { capabilities: state.capabilities, relations: state.relations } } }),
    post: async (_path, body) => {
      expect(body).toMatchObject({ source: 'model', contextTokens: ['map-context'] });
      const answer = (body as { answer: string }).answer;
      const parsed = parseMapRecord(answer);
      if (parsed.problems.length > 0) return { ok: false, status: 422, data: { error: { code: 'map_invalid', message: 'схема', blockers: parsed.problems } } };
      const change = parsed.change.functional;
      const blockers = lintDetails(lintStrategicChange(change, state, standard, answer));
      if (blockers.length > 0) return { ok: false, status: 422, data: { error: { code: 'map_lint', message: 'Карта не прошла линтер: черновик не создан', blockers } } };
      drafts.push(answer);
      const removedIds = new Set((change?.removed?.capabilities ?? []).map((item) => item.id));
      const key = (rel: Rel) => `${rel.from}>${rel.to}:${rel.type}`;
      const removedRels = new Set((change?.removed?.relations ?? []).map(key));
      state.capabilities = state.capabilities.filter((item) => !removedIds.has(item.id));
      state.relations = state.relations.filter((item) => !removedRels.has(key(item)));
      for (const cap of (change?.added?.capabilities ?? []) as Cap[]) {
        const at = state.capabilities.findIndex((item) => item.id === cap.id);
        if (at === -1) state.capabilities.push(cap); else state.capabilities[at] = cap;
      }
      for (const rel of (change?.added?.relations ?? []) as Rel[]) state.relations.push(rel);
      return { ok: true, status: 200, data: { record: { id: `M-${drafts.length}` }, path: `maps/M-${drafts.length}.md` } };
    }
  };
  return { state, drafts, api };
}

describe('карты через MCP (V-0152)', async () => {
  const registry = createRegistry(await loadTools(libDir));
  const run = (stub: ReturnType<typeof consoleStub>, name: string, args: Record<string, unknown>) =>
    callTool(registry, name, { contextToken: 'map-context', ...args }, { api: stub.api, projectId: 'p' }, { writable: true, secret: 'test-auth-secret' });

  it('карты читаются без права записи', () => {
    const names = registry.tools.map((tool) => tool.name).filter((name) => name.startsWith('map_'));
    expect(names).toEqual(['map_add_nodes', 'map_apply', 'map_connect', 'map_get', 'map_remove', 'map_update']);
    expect(registry.find('map_get')?.access).toBe('read');
  });

  it('карта из пустой: три узла и две связи; связь в никуда — отказ с узлом и полем', async () => {
    const stub = consoleStub();
    expect(JSON.parse((await run(stub, 'map_get', {})).text)).toMatchObject({ contextToken: 'map-context', current: { capabilities: [], relations: [] } });
    const added = await run(stub, 'map_add_nodes', { nodes: [
      { id: 'shop', title: 'Магазин', summary: 'Продаёт книги' },
      { id: 'shop.cart', title: 'Корзина', summary: 'Собирает заказ', parent: 'shop' },
      { id: 'pay', title: 'Оплата', summary: 'Принимает деньги', kind: 'external' }
    ] });
    expect(added).toMatchObject({ isError: false, text: expect.stringContaining('M-1 — черновик карты') });
    expect(stub.drafts[0]).toContain('```docdd-functional');
    const linked = await run(stub, 'map_connect', { relations: [
      { from: 'shop.cart', to: 'pay', type: 'uses', summary: 'Оплата заказа' },
      { from: 'shop', to: 'shop.cart', type: 'depends' }
    ] });
    expect(linked.isError).toBe(false);
    expect(stub.state.capabilities.map((item) => item.id)).toEqual(['shop', 'shop.cart', 'pay']);
    expect(stub.state.relations).toHaveLength(2);
    const context = JSON.parse((await run(stub, 'map_get', {})).text);
    expect(context.current.capabilities).toHaveLength(3);
    expect(context.current.relations).toContainEqual({ from: 'shop.cart', to: 'pay', type: 'uses', summary: 'Оплата заказа' });

    const dangling = await run(stub, 'map_connect', { relations: [{ from: 'shop', to: 'ghost', type: 'uses' }] });
    expect(dangling.isError).toBe(true);
    expect(dangling.text).toContain('map_lint');
    expect(dangling.text).toContain('ghost');
    expect(dangling.text).toMatch(/строка \d+/);
    expect(stub.drafts).toHaveLength(2);
  });

  it('узел без назначения — отказ линтера; повторное добавление — подсказка про map_update', async () => {
    const stub = consoleStub();
    const bare = await run(stub, 'map_add_nodes', { nodes: [{ id: 'a', title: 'А' }] });
    expect(bare.isError).toBe(true);
    expect(bare.text).toContain('summary');
    await run(stub, 'map_add_nodes', { nodes: [{ id: 'a', title: 'А', summary: 'Нужен' }] });
    expect((await run(stub, 'map_add_nodes', { nodes: [{ id: 'a', title: 'А', summary: 'Нужен' }] })).text).toContain('map_update');
  });

  it('map_update меняет названное и сохраняет остальное; map_remove уносит связи узла', async () => {
    const stub = consoleStub();
    await run(stub, 'map_add_nodes', { nodes: [{ id: 'a', title: 'А', summary: 'Первый' }, { id: 'b', title: 'Б', summary: 'Второй' }] });
    await run(stub, 'map_connect', { relations: [{ from: 'a', to: 'b', type: 'uses' }] });
    expect((await run(stub, 'map_update', { nodes: [{ id: 'a', status: 'implemented' }] })).isError).toBe(false);
    expect(stub.state.capabilities[0]).toMatchObject({ id: 'a', title: 'А', summary: 'Первый', status: 'implemented' });
    expect((await run(stub, 'map_update', { nodes: [{ id: 'zz', title: 'Нет' }] })).text).toContain('map_add_nodes');
    expect((await run(stub, 'map_remove', { nodes: ['b'] })).isError).toBe(false);
    expect(stub.state.capabilities.map((item) => item.id)).toEqual(['a']);
    expect(stub.state.relations).toEqual([]);
  });

  it('необъявленная пользовательская карта — отказ до черновика, с перечнем карт', async () => {
    const stub = consoleStub();
    const outcome = await run(stub, 'map_connect', { map: 'teams', relations: [{ from: 'a', to: 'b', type: 'owns' }] });
    expect(outcome).toMatchObject({ isError: true, text: expect.stringContaining('Есть: strategic') });
    expect(stub.drafts).toEqual([]);
  });

  it('запись без входа — отказ до API', async () => {
    const stub = consoleStub();
    const outcome = await callTool(registry, 'map_add_nodes', { nodes: [{ id: 'a' }] }, { api: stub.api, projectId: 'p' }, { writable: false, secret: 'x' });
    expect(outcome.isError).toBe(true);
    expect(stub.drafts).toEqual([]);
  });

  it('map_apply требует контекст и передаёт его вместе с блоком карты', async () => {
    const stub = consoleStub();
    const answer = [
      '```docdd-functional',
      '{"added":{"capabilities":[{"id":"a","title":"А","summary":"Назначение"}]}}',
      '```'
    ].join('\n');
    expect((await run(stub, 'map_apply', { answer })).isError).toBe(true);
    expect(stub.drafts).toEqual([]);
    const { contextToken } = JSON.parse((await run(stub, 'map_get', {})).text);
    expect((await run(stub, 'map_apply', { answer, contextTokens: [contextToken] })).isError).toBe(false);
    expect(stub.drafts).toEqual([answer]);
  });
});

describe('линтер пользовательских карт (V-0151)', () => {
  const definitions = [{ id: 'teams', title: 'Команды', node: { label: 'Команда' }, relations: [{ id: 'owns', label: 'владеет' }] }];

  it('вид связи — из определения карты; связь в никуда и узел без назначения — ошибки', () => {
    const findings = lintCustomChange({ map: 'teams', added: {
      nodes: [{ id: 'core', title: 'Ядро' }],
      relations: [{ from: 'core', to: 'ghost', type: 'owns' }, { from: 'core', to: 'core', type: 'feeds' }]
    } }, definitions, { nodes: [] });
    const codes = findings.filter((item) => item.severity === 'error').map((item) => `${item.code}:${item.field}`);
    expect(codes).toEqual(expect.arrayContaining(['map_lint_field:summary', 'map_lint_dangling:to', 'map_lint_edge_kind:kind']));
  });

  it('чистая запись проходит; узел другой карты линтер этой не судит', () => {
    expect(lintCustomChange({ map: 'teams', added: { nodes: [{ id: 'core', title: 'Ядро', summary: 'Платформа' }] } }, definitions, { nodes: [] })).toEqual([]);
    expect(lintCustomChange({ map: 'other', added: { nodes: [{ id: 'x' }] } }, definitions, { nodes: [] })).toEqual([]);
  });

  it('правка файла руками: черновик пользовательской карты с ошибкой — map_lint в проверке', () => {
    const manifest = {
      contract: 'docdd.workspace/1', project: { id: 'demo', name: 'Demo' }, paths: { maps: 'maps' },
      maps: { custom: [{ id: 'teams', title: 'Команды', node: { label: 'Команда', plural: 'Команды' }, relations: [{ id: 'owns', label: 'владеет', style: 'uses' }] }] }
    };
    const file = (status: string): SourceFile => ({
      source: { path: 'docs/development/maps/M-0001-m.md' },
      text: `---\nid: M-0001\ntype: map\ntitle: Карта\nstatus: ${status}\ncreated: 2026-11-23\nupdated: 2026-11-23\n---\n\n# Карта\n\n\`\`\`docdd-custom\n${JSON.stringify({ map: 'teams', added: { nodes: [{ id: 'core', title: 'Ядро' }] } }, null, 2)}\n\`\`\`\n\n## Журнал\n\n- 2026-11-23 · заведена · тест\n`
    });
    const lint = (files: SourceFile[]) => analyze({ files, manifest, readSource: (path) => files.find((item) => item.source.path === path)?.text ?? null }).violations.filter((item) => item.code.startsWith('map_lint'));
    expect(lint([file('draft')])).toEqual([expect.objectContaining({ code: 'map_lint', id: 'M-0001', message: expect.stringContaining('summary') })]);
    expect(lint([file('approved')])).toEqual([]);
  });

  it('прежний узел без назначения на карте — предупреждение, а не ошибка', () => {
    const standard = standardFor('strategic', [])?.standard;
    if (!standard) throw new Error('нет стандарта');
    const findings = lintGraph({ nodes: [{ id: 'old', title: 'Старый' }], edges: [], known: new Map([['old', { id: 'old', title: 'Старый' }]]) }, standard);
    expect(findings.map((item) => item.severity)).toEqual(['warning']);
  });
});
