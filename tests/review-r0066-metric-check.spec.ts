// V-0066
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { passesThreshold, prometheusValue } from '../server/lib/metrics';
import { runMetricCheck } from '../server/utils/verified-service';

/** R-0066: проверка-метрика берёт значение у Prometheus (заглушка fetch), сверяет с порогом, пишет отчёт; без адреса — честный skipped. */

const LF = String.fromCharCode(10);
let root = '';

function put(id: string, extra: string[]) {
  mkdirSync(join(root, 'docs', 'development', 'tests'), { recursive: true });
  writeFileSync(join(root, 'docs', 'development', 'tests', `${id}-m.md`), [
    '---', `id: ${id}`, 'type: verification', `title: Метрика ${id}`, 'status: approved', 'kind: metric',
    'created: 2026-10-01', 'updated: 2026-10-01', ...extra, '---', '', `# Метрика ${id}`, '', '## Журнал', '', '- 2026-10-01 · заведена · architect', ''
  ].join(LF), 'utf8');
}

const prom = (value: string) => ({ ok: true, status: 200, json: async () => ({ status: 'success', data: { resultType: 'vector', result: [{ metric: {}, value: [1, value] }] } }) });
const env = { url: process.env['DOCDD_PROMETHEUS_URL'] };

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'docdd-metric-'));
  mkdirSync(join(root, 'docs', 'development'), { recursive: true });
  writeFileSync(join(root, 'docs', 'development', 'project.yaml'), ['contract: docdd.workspace/1', 'project:', '  id: demo', '  name: Demo', 'paths:', '  tests: tests', ''].join(LF), 'utf8');
  put('V-0001', ['query: rate(errors_total[5m])', 'threshold: 5']);
  put('V-0002', ['query: up', 'threshold: 0.99', 'operator: gte']);
  put('V-0003', []);
  process.env['DOCDD_PROMETHEUS_URL'] = 'http://prom.test/';
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (env.url === undefined) delete process.env['DOCDD_PROMETHEUS_URL'];
  else process.env['DOCDD_PROMETHEUS_URL'] = env.url;
});

const reports = () => readdirSync(join(root, 'docs', 'development', 'tests', 'reports'));

describe('чистые функции', () => {
  it('значение: вектор, скаляр, мусор', () => {
    expect(prometheusValue({ data: { resultType: 'vector', result: [{ value: [1, '3.5'] }] } })).toBe(3.5);
    expect(prometheusValue({ data: { resultType: 'scalar', result: [1, '2'] } })).toBe(2);
    expect(prometheusValue({ data: { resultType: 'vector', result: [] } })).toBeNull();
    expect(prometheusValue(null)).toBeNull();
  });
  it('порог: lte по умолчанию, gte по запросу, граница включена', () => {
    expect(passesThreshold(5, 5, undefined)).toBe(true);
    expect(passesThreshold(5.1, 5, 'lte')).toBe(false);
    expect(passesThreshold(0.98, 0.99, 'gte')).toBe(false);
    expect(passesThreshold(0.99, 0.99, 'gte')).toBe(true);
  });
});

describe('прогон проверки-метрики', () => {
  it('значение в пределах порога — passed, запрос ушёл на адрес без двойного слеша', async () => {
    const fetchMock = vi.fn(async () => prom('3'));
    vi.stubGlobal('fetch', fetchMock);
    const out = await runMetricCheck(root, 'V-0001', 'ci');
    expect(out).toMatchObject({ ok: true, state: 'passed', value: 3 });
    const url = String((fetchMock.mock.calls[0] as unknown[])[0]);
    expect(url).toBe(`http://prom.test/api/v1/query?query=${encodeURIComponent('rate(errors_total[5m])')}`);
    expect(reports().length).toBe(1);
  });

  it('значение выше порога lte — failed, и отчёт это отражает', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => prom('9')));
    const out = await runMetricCheck(root, 'V-0001', 'ci');
    expect(out).toMatchObject({ ok: true, state: 'failed', value: 9 });
    const report = JSON.parse(readFileSync(join(root, 'docs', 'development', 'tests', 'reports', reports()[0]!), 'utf8'));
    expect(report.verifications['V-0001']).toBe('failed');
  });

  it('operator gte: меньше порога — failed, не меньше — passed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => prom('0.5')));
    expect(await runMetricCheck(root, 'V-0002', 'ci')).toMatchObject({ state: 'failed' });
    vi.stubGlobal('fetch', vi.fn(async () => prom('1')));
    expect(await runMetricCheck(root, 'V-0002', 'ci')).toMatchObject({ state: 'passed' });
  });

  it('без DOCDD_PROMETHEUS_URL — skipped, сеть не трогается', async () => {
    delete process.env['DOCDD_PROMETHEUS_URL'];
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const out = await runMetricCheck(root, 'V-0001', 'ci');
    expect(out).toMatchObject({ ok: true, state: 'skipped', value: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Prometheus недоступен или ответил пусто — skipped, а не выдуманный успех', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
    expect(await runMetricCheck(root, 'V-0001', 'ci')).toMatchObject({ state: 'skipped' });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: { resultType: 'vector', result: [] } }) })));
    expect(await runMetricCheck(root, 'V-0001', 'ci')).toMatchObject({ state: 'skipped' });
  });

  it('проверка без query/threshold — отказ 409; чужой вид — отказ; нет записи — 404', async () => {
    vi.stubGlobal('fetch', vi.fn());
    expect(await runMetricCheck(root, 'V-0003', 'ci')).toMatchObject({ ok: false, status: 409, code: 'metric_not_configured' });
    expect(await runMetricCheck(root, 'V-9999', 'ci')).toMatchObject({ ok: false, status: 404 });
  });
});
