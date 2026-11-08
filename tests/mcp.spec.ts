import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { callTool, createRegistry, cutToBudget, loadTools, READ_ONLY_REASON, type ApiClient, type McpTool } from '../server/lib/mcp';
import { checkArchitecture } from '../server/lib/architecture';

const libDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'server', 'lib');
const SECRET = 'agent.1.999.signature';

const records = [
  { id: 'T-1', type: 'task', title: 'Готовая', status: 'ready', links: {} },
  { id: 'T-2', type: 'task', title: 'Ждёт T-3', status: 'ready', links: { depends_on: ['T-3'] } },
  { id: 'T-3', type: 'task', title: 'В работе', status: 'in_progress', links: {} },
  { id: 'R-1', type: 'requirement', title: 'Требование', status: 'approved', links: {} }
];

function fakeApi(): ApiClient & { posts: { path: string; body: unknown }[] } {
  const posts: { path: string; body: unknown }[] = [];
  return {
    posts,
    get: async (path) => (path.endsWith('/issues')
      ? { ok: true, status: 200, data: { issues: Array.from({ length: 500 }, (_, at) => ({ code: 'x', severity: at === 499 ? 'error' : 'warning', recordId: 'T-1', message: 'м'.repeat(100) })) } }
      : { ok: true, status: 200, data: { records, issues: [{ severity: 'error' }, { severity: 'warning' }] } }),
    post: async (path, body) => {
      posts.push({ path, body });
      if (path.endsWith('/context')) return { ok: true, status: 200, data: { prompt: 'пакет задачи' } };
      if (path.includes('fail')) return { ok: false, status: 409, data: { error: { code: 'nope', message: `отказ ${SECRET}` } } };
      return { ok: true, status: 200, data: { record: { id: 'T-9' } } };
    }
  };
}

describe('MCP: инструменты, белый список, режим чтения (V-0115)', async () => {
  const registry = createRegistry(await loadTools(libDir));
  const call = (name: string, args: Record<string, unknown>, writable = true, api = fakeApi()) =>
    callTool(registry, name, args, { api, projectId: 'p' }, { writable, secret: SECRET });

  it('набор инструментов: подтвердить, закрыть и слить нечем', () => {
    expect(registry.tools.map((tool) => tool.name)).toEqual(['add_journal_line', 'create_draft', 'list_issues', 'move_task', 'next_tasks', 'project_status', 'task_context']);
    expect(registry.tools.filter((tool) => tool.access === 'write').map((tool) => tool.name).sort()).toEqual(['add_journal_line', 'create_draft', 'move_task']);
    expect(registry.tools.some((tool) => /approve|merge|close|accept|confirm/i.test(tool.name))).toBe(false);
  });

  it('без входа запись отказывает и не доходит до API', async () => {
    const api = fakeApi();
    for (const [name, args] of [['create_draft', { type: 'task', title: 'x' }], ['add_journal_line', { id: 'T-1', text: 'x' }], ['move_task', { id: 'T-1', to: 'in_progress' }]] as const) {
      expect(await call(name, args, false, api)).toEqual({ text: READ_ONLY_REASON, isError: true });
    }
    expect(api.posts).toEqual([]);
  });

  it('чтение работает без права записи', async () => {
    expect((await call('project_status', {}, false)).text).toContain('Записей: 4. Ошибок: 1. Предупреждений: 1.');
    expect((await call('task_context', { id: 'T-1' }, false)).text).toBe('пакет задачи');
  });

  it('next_tasks не предлагает задачу с открытой зависимостью', async () => {
    const { text } = await call('next_tasks', {}, false);
    expect(text).toContain('T-1');
    expect(text).toContain('T-3 · в работе');
    expect(text).not.toContain('T-2');
  });

  it('ответ ограничен бюджетом и сверху говорит об отрезанном; ошибки идут первыми', async () => {
    const { text } = await call('list_issues', {}, false);
    expect(text.length).toBeLessThan(6_200);
    expect(text.startsWith('[отрезано:')).toBe(true);
    expect(text.split('\n')[1]).toContain('error');
    expect((await call('list_issues', { budget: 400 }, false)).text.length).toBeLessThan(600);
    expect((await call('list_issues', { budget: 10_000_000 }, false)).text.length).toBeLessThan(6_200);
  });

  it('переходы вне белого списка — отказ', async () => {
    const api = fakeApi();
    for (const to of ['done', 'approved', 'ready', 'backlog', 'dropped']) {
      const outcome = await call('move_task', { id: 'T-1', to }, true, api);
      expect(outcome.isError).toBe(true);
    }
    expect((await call('move_task', { id: 'T-3', to: 'in_progress' }, true, api)).isError).toBe(true);
    expect((await call('move_task', { id: 'R-1', to: 'in_progress' }, true, api)).isError).toBe(true);
    expect(api.posts).toEqual([]);
  });

  it('разрешённый переход идёт через API статуса', async () => {
    const api = fakeApi();
    expect((await call('move_task', { id: 'T-1', to: 'in_progress' }, true, api)).isError).toBe(false);
    expect(api.posts).toEqual([{ path: '/api/projects/p/records/T-1/status', body: { status: 'in_progress' } }]);
  });

  it('черновик: только разрешённые типы', async () => {
    expect((await call('create_draft', { type: 'map', title: 'x' })).isError).toBe(true);
    expect((await call('create_draft', { type: 'task', title: 'x' })).text).toContain('T-9');
  });

  it('токен не доходит до ответа, даже внутри ошибки', async () => {
    const outcome = await call('add_journal_line', { id: 'fail', text: 'x' });
    expect(outcome.isError).toBe(true);
    expect(outcome.text).not.toContain(SECRET);
  });
});

describe('Реестр и границы модулей (V-0121)', () => {
  const made: string[] = [];
  afterAll(() => { for (const dir of made) rmSync(dir, { recursive: true, force: true }); });

  const tool = (name: string): McpTool => ({ name, description: '', inputSchema: {}, access: 'read', run: async () => 'ok' });

  it('инструмент из файла модуля попадает в реестр без правки сервера', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-tools-'));
    made.push(dir);
    mkdirSync(join(dir, 'extra', 'tools'), { recursive: true });
    writeFileSync(join(dir, 'extra', 'tools', 'hello.mjs'), "export default { name: 'hello', description: '', inputSchema: {}, access: 'read', run: async () => 'привет' };\n");
    const registry = createRegistry(await loadTools(dir));
    expect(registry.find('hello')).toBeDefined();
  });

  it('файл без инструмента — ошибка с именем файла', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-tools-'));
    made.push(dir);
    mkdirSync(join(dir, 'extra', 'tools'), { recursive: true });
    writeFileSync(join(dir, 'extra', 'tools', 'broken.mjs'), 'export default {};\n');
    await expect(loadTools(dir)).rejects.toThrow('broken.mjs');
  });

  it('два инструмента с одним именем — ошибка запуска', () => {
    expect(() => createRegistry([tool('a'), tool('a')])).toThrow('дважды');
  });

  it('импорт мимо входа модуля даёт предупреждение архитектурной сверки', () => {
    const files = ['server/lib/mcp/index.ts', 'server/lib/mcp/budget.ts', 'server/lib/tokens/index.ts', 'server/lib/tokens/report.ts'];
    const result = checkArchitecture({
      files,
      modules: [{ id: 'mcp', path: 'server/lib/mcp' }, { id: 'tokens', path: 'server/lib/tokens' }],
      imports: [{ from: 'server/lib/tokens/report.ts', to: 'server/lib/mcp/budget.ts' }],
      config: { entries: { typescript: ['index.ts'] } }
    } as Parameters<typeof checkArchitecture>[0]);
    expect(result.findings.some((item) => item.code === 'arch_entry_bypassed')).toBe(true);
  });
});

describe('cutToBudget', () => {
  it('короткий текст не трогает', () => expect(cutToBudget('a\nb', 100)).toBe('a\nb'));
  it('режет по целым строкам', () => expect(cutToBudget('ааа\nббб\nввв', 5)).toContain('показано строк 1 из 3'));
});
