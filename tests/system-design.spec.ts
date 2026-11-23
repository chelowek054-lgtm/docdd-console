import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { analyze } from '../server/lib/analyze';
import { parseMapRecord } from '../server/lib/maps';
import { compareProjectDesign } from '../server/utils/system-design-service';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const block = (kind: string, added: unknown) => '```docdd-' + kind + '\n' + JSON.stringify({ added }) + '\n```';
const record = (id: string, type: string, extra = '', body = '') =>
  `---\nid: ${id}\ntype: ${type}\ntitle: Example\nstatus: approved\ncreated: 2026-11-23\nupdated: 2026-11-23\n${extra}---\n\n# Example\n\n${body}\n`;
const moduleNode = (id: string) => ({ id, title: id, kind: 'component', detail: 'template', reference: 'S-0001', realized_by: [id + '.ts'] });

describe('карта System Design', () => {
  it('подробный узел указывает нагрузку; для шаблонного достаточно справки', () => {
    const node = { ...moduleNode('a'), detail: 'detailed', inputs: [], outputs: [], formats: ['JSON'], hot_path: 'lookup', algorithm: 'index', language: 'TS', runtime: 'Node' };
    expect(parseMapRecord(block('sysdesign', { nodes: [node] })).problems[0]?.message).toContain('load');
    expect(parseMapRecord(block('sysdesign', { nodes: [{ ...node, load: { value: 250, unit: 'req/s' } }, moduleNode('b')] })).problems).toEqual([]);
  });

  it('проверяет конфиги, покрытие и метрику требования через общий анализ', () => {
    const standard = { id: 'python', language: 'Python', configs: ['ruff.toml'], coverage_min: 80, coverage_report: 'coverage.json' };
    const files = [
      { source: { path: 'docs/development/maps/M-0001-sd.md' }, text: record('M-0001', 'map', '', block('sysdesign', { standards: [standard] })) },
      { source: { path: 'docs/development/requirements/R-0001-load.md' }, text: record('R-0001', 'requirement', 'quality: load\n') }
    ];
    const codes = (resources: Record<string, string>) => analyze({ files, readSource: (path) => resources[path] ?? null }).violations.map((item) => item.code);
    expect(codes({})).toEqual(expect.arrayContaining(['standard_config_missing', 'standard_coverage_low', 'quality_unmeasured']));
    files.push({ source: { path: 'docs/development/tests/V-0001-metric.md' }, text: record('V-0001', 'verification', 'kind: metric\nlinks:\n  verifies: [R-0001]\n') });
    const result = codes({ 'ruff.toml': '', 'coverage.json': '{"total":{"lines":{"pct":80}}}' });
    expect(result.filter((code) => ['standard_config_missing', 'standard_coverage_low', 'quality_unmeasured'].includes(code))).toEqual([]);
  });

  it('сверяет проект на диске и возвращает только расхождения с их местами', () => {
    const root = mkdtempSync(join(tmpdir(), 'docdd-sd-'));
    dirs.push(root);
    const docs = join(root, 'docs/development');
    mkdirSync(join(docs, 'maps'), { recursive: true });
    mkdirSync(join(docs, 'contracts'));
    writeFileSync(join(docs, 'project.yaml'), 'contract: docdd.workspace/1\nproject: { id: demo, name: Demo }\npaths: { maps: maps, contracts: contracts }\n');
    const contract = join(docs, 'contracts/C-0001-api.md');
    writeFileSync(contract, record('C-0001', 'contract', 'inputs: [message]\noutputs: []\n'));
    const file = join(docs, 'maps/M-0001-design.md');
    const ids = ['a', 'b', 'c'];
    const nodes = ids.map(moduleNode);
    const write = (broken: boolean) => {
      const design = { nodes: [{ ...nodes[0], contract: 'C-0001', inputs: [broken ? 'wrong' : 'message'], outputs: [] }, ...nodes.slice(1)],
        relations: broken ? [] : [{ from: 'a', to: 'b', kind: 'call', label: 'message' }] };
      const code = { modules: (broken ? ['a', 'b', 'extra'] : ids).map((id) => ({ id: id + '.ts', path: id + '.ts', title: id })),
        imports: [{ from: 'a.ts', to: 'b.ts', evidence: { path: 'a.ts', fragment: 'import b', line: 3 } }] };
      writeFileSync(file, record('M-0001', 'map', '', block('sysdesign', design) + '\n' + block('codemap', code)));
    };
    write(true);
    expect(compareProjectDesign(root).map(({ code, location }) => [code, location])).toEqual([
      ['contract_mismatch', 'a'], ['module_without_code', 'c'], ['code_outside_design', 'extra.ts'], ['undeclared_dependency', 'a.ts:3']
    ]);
    write(false);
    expect(compareProjectDesign(root)).toEqual([]);
  });
});
