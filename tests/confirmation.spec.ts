// Подтверждение моделью после вопроса человеку и запись MCP на localhost (A-0008; V-0143, V-0144).
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { agentVerdict, type AgentRecord } from '../server/lib/agents';
import { confirmationActor, parseConfirmation, writeAccess } from '../server/lib/confirmation';
import { can } from '../server/lib/permissions';
import { callTool, createApiClient, createRegistry, loadTools, type ApiClient } from '../server/lib/mcp';
import { confirmedActor } from '../server/utils/confirmed-actor';

const libDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'server', 'lib');
const yes = { by: 'ann', question: 'Подтвердить R-1 и A-1?', answer: 'да' };

describe('подтверждение: разбор и подпись', () => {
  it('нет поля — подтверждения нет; неполное — ошибка с именем поля', () => {
    expect(parseConfirmation(undefined)).toEqual({ ok: true, confirmation: null });
    expect(parseConfirmation({ by: 'ann', question: 'q' })).toMatchObject({ ok: false, message: expect.stringContaining('answer') });
    expect(parseConfirmation('да')).toMatchObject({ ok: false });
  });
  it('подпись журнала несёт кто, через кого, вопрос и ответ одной строкой', () => {
    const parsed = parseConfirmation({ by: 'ann', question: 'Подтвердить\nR-1 · ?', answer: 'да' });
    if (!parsed.ok || !parsed.confirmation) throw new Error('разбор не удался');
    const line = confirmationActor('Dev (developer) · агент', parsed.confirmation);
    expect(line).toBe('ann через Dev (developer) · агент, вопрос: «Подтвердить R-1 - ?», ответ: «да»');
    expect(line).not.toContain('\n');
  });
});

describe('ограничения агента с подтверждением (V-0143)', () => {
  const records: AgentRecord[] = [
    { id: 'R-1', type: 'requirement', status: 'review', links: { verified_by: ['V-1'] } },
    { id: 'A-1', type: 'decision', status: 'review', links: {} },
    { id: 'V-1', type: 'verification', status: 'approved', links: { verifies: ['R-1'] } },
    { id: 'T-1', type: 'task', status: 'in_review', links: { implements: ['R-1'] }, extra: { assignee: 'dev-bot' } }
  ];
  const v = (path: string, body: Record<string, unknown>) => agentVerdict('dev-bot', 'POST', path, body, records);

  it('без подтверждения — отказ, с ним — можно: документ, пачка, своя задача, «Проверено»', () => {
    expect(v('/api/projects/p/records/R-1/status', { status: 'approved' })).toMatchObject({ allowed: false, code: 'agent_document_approve' });
    expect(v('/api/projects/p/records/R-1/status', { status: 'approved', confirmation: yes }).allowed).toBe(true);
    expect(v('/api/projects/p/records/bulk/status', { ids: ['R-1', 'A-1'], direction: 'forward', confirmation: yes }).allowed).toBe(true);
    expect(v('/api/projects/p/records/T-1/status', { status: 'done' })).toMatchObject({ allowed: false, code: 'agent_own_acceptance' });
    expect(v('/api/projects/p/records/T-1/status', { status: 'done', confirmation: yes }).allowed).toBe(true);
    expect(v('/api/projects/p/records/V-1/verified', { verified: true, confirmation: yes }).allowed).toBe(true);
  });
  it('слияние, команда и администрирование агенту закрыты и с подтверждением', () => {
    expect(can({ login: 'dev-bot', admin: false, agent: { type: 'developer' } }, [{ login: 'dev-bot', roles: ['architect'] }], 'merge').allowed).toBe(false);
  });
  it('пустое подтверждение не считается', () => {
    expect(v('/api/projects/p/records/R-1/status', { status: 'approved', confirmation: { by: 'ann', question: '', answer: 'да' } }).allowed).toBe(false);
  });
  it('текст документа подтверждение не открывает', () => {
    expect(v('/api/projects/p/records/R-1/body', { confirmation: yes })).toMatchObject({ allowed: false, code: 'agent_text_edit' });
  });
});

describe('подпись и роли из подтверждения на сервере', () => {
  const made: string[] = [];
  afterAll(() => { for (const dir of made) rmSync(dir, { recursive: true, force: true }); });
  const root = () => { const dir = mkdtempSync(join(tmpdir(), 'confirm-')); made.push(dir); return dir; };

  it('без подтверждения подпись не меняется', () => {
    expect(confirmedActor(root(), {}, 'Ann', {})).toEqual({ ok: true, actor: 'Ann', roles: null });
  });
  it('неполное — отказ с объяснением', () => {
    expect(confirmedActor(root(), { confirmation: { by: 'ann' } }, 'bot', {})).toMatchObject({ ok: false });
  });
  it('человек со входом чужими ролями не пользуется', () => {
    const outcome = confirmedActor(root(), { confirmation: yes }, 'Bob', { user: { login: 'bob', agent: false } });
    expect(outcome).toMatchObject({ ok: true, roles: null, actor: expect.stringContaining('ann через Bob') });
  });
});

describe('запись MCP: вход × адрес × токен (V-0144)', () => {
  it('без входа — только localhost', () => {
    for (const baseUrl of ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://[::1]:3000']) {
      expect(writeAccess({ baseUrl, authRequired: false, agent: false })).toEqual({ writable: true });
    }
    const remote = writeAccess({ baseUrl: 'http://team.example:3000', authRequired: false, agent: false });
    expect(remote.writable).toBe(false);
    expect(remote.reason).toContain('localhost');
  });
  it('со входом — только токен агента, где бы ни была консоль', () => {
    expect(writeAccess({ baseUrl: 'http://localhost:3000', authRequired: true, agent: false }).writable).toBe(false);
    expect(writeAccess({ baseUrl: 'http://team.example', authRequired: true, agent: true })).toEqual({ writable: true });
  });
  it('консоль не ответила — только чтение', () => {
    expect(writeAccess({ baseUrl: 'http://localhost:3000', authRequired: null, agent: false }).writable).toBe(false);
  });
  it('без входа тело записи подписано «модель · MCP»; своя подпись не затирается', async () => {
    const sent: unknown[] = [];
    const fetcher = (async (_url: string, init?: RequestInit) => { sent.push(JSON.parse(String(init?.body))); return new Response('{}'); }) as typeof fetch;
    const api = createApiClient({ baseUrl: 'http://localhost:3000', fetcher });
    await api.post('/x', { status: 'in_progress' });
    await api.post('/x', { actor: 'Ann' });
    expect(sent).toEqual([{ status: 'in_progress', actor: 'модель · MCP' }, { actor: 'Ann' }]);
  });
});

describe('инструменты MCP с подтверждением (V-0143)', async () => {
  const registry = createRegistry(await loadTools(libDir));
  const index = { records: [{ id: 'T-1', type: 'task', status: 'in_review' }, { id: 'T-2', type: 'task', status: 'in_progress' }, { id: 'R-1', type: 'requirement', status: 'review' }] };
  const fakeApi = () => {
    const posts: { path: string; body: unknown }[] = [];
    const api: ApiClient = {
      get: async () => ({ ok: true, status: 200, data: index }),
      post: async (path, body) => { posts.push({ path, body }); return path.includes('A-9') ? { ok: false, status: 403, data: { error: { code: 'architect_only', message: 'только архитектор' } } } : { ok: true, status: 200, data: {} }; }
    };
    return { api, posts };
  };
  const call = (name: string, args: Record<string, unknown>, api: ApiClient) => callTool(registry, name, args, { api, projectId: 'p' }, { writable: true });
  const ask = { confirmed_by: 'ann', question: 'Подтвердить R-1, A-9? Принять T-1? Проверено V-1?', answer: 'да' };

  it('без полей подтверждения — ошибка с объяснением, до API не доходит', async () => {
    const { api, posts } = fakeApi();
    for (const [name, args] of [['approve_records', { ids: ['R-1'] }], ['accept_task', { id: 'T-1' }], ['accept_check', { id: 'V-1', note: 'смотрела' }]] as const) {
      const outcome = await call(name, args, api);
      expect(outcome.isError).toBe(true);
      expect(outcome.text).toContain('спросите человека');
    }
    expect(posts).toEqual([]);
  });
  it('запись, о которой не спросили, не подтверждается', async () => {
    const { api, posts } = fakeApi();
    expect((await call('approve_records', { ids: ['R-7'], ...ask }, api)).text).toContain('R-7');
    expect(posts).toEqual([]);
  });
  it('approve_records несёт подтверждение и называет отказ по каждой записи', async () => {
    const { api, posts } = fakeApi();
    const outcome = await call('approve_records', { ids: ['R-1', 'A-9'], ...ask }, api);
    expect(outcome.text).toBe('R-1: подтверждена\nA-9: Отказ консоли (403, architect_only): только архитектор');
    expect(posts[0]).toEqual({ path: '/api/projects/p/records/R-1/status', body: { status: 'approved', confirmation: { by: 'ann', question: ask.question, answer: 'да' } } });
  });
  it('accept_task — только задача на проверке', async () => {
    const { api, posts } = fakeApi();
    expect((await call('accept_task', { id: 'T-1', ...ask }, api)).text).toBe('T-1: in_review → done.');
    expect((await call('accept_task', { id: 'T-2', ...ask, question: 'Принять T-2?' }, api)).isError).toBe(true);
    expect((await call('accept_task', { id: 'R-1', ...ask }, api)).isError).toBe(true);
    expect(posts).toHaveLength(1);
  });
  it('accept_check требует слов человека о том, что проверено', async () => {
    const { api, posts } = fakeApi();
    expect((await call('accept_check', { id: 'V-1', note: '', ...ask }, api)).isError).toBe(true);
    expect((await call('accept_check', { id: 'V-1', note: 'открыла и закрыла задачу', ...ask }, api)).isError).toBe(false);
    expect(posts[0]?.body).toMatchObject({ verified: true, by: 'ann', note: 'открыла и закрыла задачу' });
  });
});
