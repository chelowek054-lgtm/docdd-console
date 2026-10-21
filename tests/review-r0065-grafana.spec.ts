// V-0065
import { mkdirSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { alertNote, llmMetrics, prometheusMetrics } from '../server/lib/metrics';
import { createNote } from '../server/utils/inbox-service';
import { rec } from './helpers';

// Nitro в vitest не поднимается: h3 подменён тонкой заглушкой, а проект — временной папкой.
const state = vi.hoisted(() => ({ root: '' }));
vi.mock('h3', () => ({
  defineEventHandler: (fn: unknown) => fn,
  getHeader: (event: { headers: Record<string, string> }, name: string) => event.headers[name],
  getRouterParam: () => 'demo',
  readBody: async (event: { body: unknown }) => event.body,
  setResponseStatus: (event: { status: number }, code: number) => { event.status = code; }
}));
vi.mock('../server/utils/projects', () => ({ findProject: async () => (state.root ? { id: 'demo', root: state.root } : null) }));

/** R-0065: метрики процесса, алерт Grafana во входящее, вебхук закрыт без токена. */

const index = {
  records: [rec('T-0001', 'task', 'done'), rec('T-0002', 'task', 'done'), rec('T-0003', 'task', 'in_progress'), rec('R-0001', 'requirement', 'approved')],
  issues: [
    { severity: 'error', code: 'a', message: 'm' }, { severity: 'warning', code: 'b', message: 'm' }, { severity: 'warning', code: 'c', message: 'm' }
  ],
  verificationResults: {
    'V-0001': { state: 'passed' }, 'V-0002': { state: 'passed' }, 'V-0003': { state: 'failed' }, 'V-0004': { state: 'skipped' }
  }
} as unknown as Parameters<typeof prometheusMetrics>[0];

describe('метрики в формате Prometheus', () => {
  const text = prometheusMetrics(index, 'demo');
  it('задачи по статусам (только задачи)', () => {
    expect(text).toContain('docdd_tasks{project="demo",status="done"} 2');
    expect(text).toContain('docdd_tasks{project="demo",status="in_progress"} 1');
    expect(text).not.toContain('status="approved"');
  });
  it('нарушения по серьёзности', () => {
    expect(text).toContain('docdd_issues{project="demo",severity="error"} 1');
    expect(text).toContain('docdd_issues{project="demo",severity="warning"} 2');
  });
  it('доля пройденных считается только по прогнанным', () => {
    expect(text).toContain('docdd_verifications{project="demo",state="skipped"} 1');
    expect(text).toContain('docdd_verifications_passed_ratio{project="demo"} 0.6666666666666666');
  });
  it('каждая строка — HELP/TYPE или «имя{метки} число»; текст кончается переводом строки', () => {
    expect(text.endsWith('\n')).toBe(true);
    for (const line of text.trim().split('\n')) {
      expect(line).toMatch(/^(# (HELP|TYPE) \w+ .+|\w+\{[^}]*\} -?\d+(\.\d+)?)$/);
    }
  });
  it('метка проекта экранируется', () => {
    expect(prometheusMetrics(index, 'a"b')).toContain('project="a\\"b"');
  });
  it('расход на модели (R-0065) отдаётся метриками', () => {
    const out = llmMetrics({ month: '2026-10', total: { requests: 3, costUsd: 0.5 } }, 'demo');
    expect(out).toContain('docdd_llm_requests{project="demo",month="2026-10"} 3');
    expect(out).toContain('docdd_llm_cost_usd{project="demo",month="2026-10"} 0.5');
  });
});

function project(): string {
  const root = mkdtempSync(join(tmpdir(), 'alert-'));
  mkdirSync(join(root, 'docs', 'development'), { recursive: true });
  mkdirSync(join(root, 'docs', 'inbox'), { recursive: true });
  writeFileSync(join(root, 'docs', 'development', 'project.yaml'), ['contract: docdd.workspace/1', 'project:', '  id: demo', '  name: Demo', 'paths:', '  requirements: requirements', 'sources:', '  inbox: [docs/inbox]', ''].join(String.fromCharCode(10)), 'utf8');
  return root;
}

describe('алерт Grafana → заметка во входящем', () => {
  const payload = {
    title: '[FIRING] x', message: 'Высокая задержка',
    alerts: [{ status: 'firing', labels: { alertname: 'HighLatency' }, annotations: { summary: 'p95 > 2s' }, generatorURL: 'http://grafana/x' }]
  };
  it('заголовок и тело берутся из алерта', () => {
    const note = alertNote(payload);
    expect(note.title).toBe('Алерт: HighLatency');
    expect(note.body).toContain('firing: HighLatency — p95 > 2s (http://grafana/x)');
  });
  it('пустой payload не падает', () => {
    expect(alertNote(null).title).toBe('Алерт: Алерт Grafana');
  });
  it('заметка появляется в docs/inbox проекта', () => {
    const root = project();
    const outcome = createNote(root, alertNote(payload));
    expect(outcome.ok).toBe(true);
    const files = readdirSync(join(root, 'docs', 'inbox'));
    expect(files.length).toBe(1);
    expect(readFileSync(join(root, 'docs', 'inbox', files[0]!), 'utf8')).toContain('HighLatency');
  });
});

describe('вебхук закрыт без токена', () => {
  const saved = process.env['DOCDD_ALERT_TOKEN'];
  afterEach(() => {
    if (saved === undefined) delete process.env['DOCDD_ALERT_TOKEN'];
    else process.env['DOCDD_ALERT_TOKEN'] = saved;
  });
  const call = async (headers: Record<string, string>, body: unknown = {}) => {
    const { default: handler } = await import('../server/api/projects/[id]/inbox/alert.post');
    const event = { headers, body, status: 200 };
    const result = await (handler as unknown as (e: unknown) => Promise<unknown>)(event);
    return { status: event.status, result };
  };
  it('токен не задан — 403, даже с заголовком', async () => {
    delete process.env['DOCDD_ALERT_TOKEN'];
    state.root = project();
    const { status } = await call({ authorization: 'Bearer anything' });
    expect(status).toBe(403);
    expect(readdirSync(join(state.root, 'docs', 'inbox'))).toEqual([]);
  });
  it('токен задан, а в запросе чужой или нет — 401, заметки нет', async () => {
    process.env['DOCDD_ALERT_TOKEN'] = 'secret-test-token';
    state.root = project();
    expect((await call({ authorization: 'Bearer wrong' })).status).toBe(401);
    expect((await call({})).status).toBe(401);
    expect(readdirSync(join(state.root, 'docs', 'inbox'))).toEqual([]);
  });
  it('верный токен — заметка во входящем, токен в ответе не возвращается', async () => {
    process.env['DOCDD_ALERT_TOKEN'] = 'secret-test-token';
    state.root = project();
    const { status, result } = await call({ authorization: 'Bearer secret-test-token' }, { alerts: [{ labels: { alertname: 'Down' } }] });
    expect(status).toBe(200);
    expect(JSON.stringify(result)).not.toContain('secret-test-token');
    expect(readdirSync(join(state.root, 'docs', 'inbox')).length).toBe(1);
  });
});
