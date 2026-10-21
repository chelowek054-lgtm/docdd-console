// V-0051
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { overBudget, payloadBytes } from '../cli/perf';

describe('R-0051 бюджет скорости', () => {
  it('payload — размер блока __NUXT_DATA__', () => {
    const html = '<html><script type="application/json" id="__NUXT_DATA__" data-ssr="true">[1,2,3]</script><script>x</script></html>';
    expect(payloadBytes(html)).toBe(7);
    expect(payloadBytes('<html></html>')).toBe(0);
  });
  it('сравнение с бюджетом: в пределах — пусто, превышение — причина на каждый показатель', () => {
    const b = { path: '/', verification: 'V-0001', maxTtfbMs: 100, maxHtmlKb: 10, maxPayloadKb: 5 };
    expect(overBudget({ ttfbMs: 100, htmlKb: 10, payloadKb: 5 }, b)).toEqual([]);
    expect(overBudget({ ttfbMs: 101, htmlKb: 11, payloadKb: 6 }, b)).toHaveLength(3);
    expect(overBudget({ ttfbMs: 9999, htmlKb: 1, payloadKb: 1 }, { path: '/', verification: 'V-0001', maxHtmlKb: 10 })).toEqual([]);
  });
  it('perf-budget.json ссылается на V-…; отчёт содержит обязательные поля схемы отчётов', () => {
    const budget = JSON.parse(readFileSync('perf-budget.json', 'utf8')) as { pages: { path: string; verification: string }[] };
    for (const p of budget.pages) expect(p.verification).toMatch(/^V-[0-9]{4}$/);
    const schema = JSON.parse(readFileSync('docs/schemas/report.schema.json', 'utf8')) as { required: string[]; properties: { contract: { const: string } } };
    const source = readFileSync('cli/perf.ts', 'utf8');
    for (const key of schema.required) expect(source).toMatch(new RegExp(`\\b${key}\\b`));
    expect(source).toContain(schema.properties.contract.const);
  });
});
