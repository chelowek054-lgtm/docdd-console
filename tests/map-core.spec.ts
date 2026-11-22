// Стандарт обозначений и линтер карт (A-0010; V-0151, V-0153).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

import { analyze, type SourceFile } from '../server/lib/analyze';
import { contrastRatio } from '../server/lib/design';
import { BUILTIN_STANDARDS, isMapToken, legendOf, lintGraph, lintStrategicChange, MAP_BACKGROUNDS, MAP_TOKENS, standardFor } from '../server/lib/map-core';

const root = join(__dirname, '..');
// Ajv опубликован как CommonJS: в ESM конструктор лежит в default (как в server/lib/schema.ts).
const AjvCtor = ((Ajv2020 as unknown as { default?: typeof Ajv2020 }).default ?? Ajv2020);
const schema = JSON.parse(readFileSync(join(root, 'docs/schemas/map-standard.schema.json'), 'utf8'));
const strategic = standardFor('strategic')?.standard;
if (!strategic) throw new Error('нет стандарта стратегической карты');

describe('стандарты четырёх обязательных шаблонов (V-0153)', () => {
  const validate = new AjvCtor({ allErrors: true, strict: false }).compile(schema);

  it('каждый проходит схему, цвета — известные токены, виды по умолчанию существуют', () => {
    expect(Object.keys(BUILTIN_STANDARDS).sort()).toEqual(['codebase', 'domain', 'strategic', 'sysdesign']);
    for (const standard of Object.values(BUILTIN_STANDARDS)) {
      expect(validate(standard), JSON.stringify(validate.errors)).toBe(true);
      for (const kind of standard.nodeKinds) expect(isMapToken(kind.color), `${standard.template}.${kind.id}`).toBe(true);
      if (standard.defaultNodeKind) expect(standard.nodeKinds.map((kind) => kind.id)).toContain(standard.defaultNodeKind);
      if (standard.defaultEdgeKind) expect(standard.edgeKinds.map((kind) => kind.id)).toContain(standard.defaultEdgeKind);
      expect(standard.sources.length).toBeGreaterThan(0);
    }
  });

  it('прежние имена видов в файлах ведут к тем же стандартам', () => {
    expect(standardFor('functional')?.standard.template).toBe('strategic');
    expect(standardFor('codemap')?.standard.template).toBe('codebase');
    expect(standardFor('dataflow')).toBeNull();
  });

  it('переопределение проекта меняет только названное', () => {
    const merged = standardFor('strategic', [{ extends: 'functional', edgeKinds: [{ id: 'feeds', line: 'solid' }] }])?.standard;
    const before = strategic.edgeKinds.find((kind) => kind.id === 'feeds');
    const after = merged?.edgeKinds.find((kind) => kind.id === 'feeds');
    expect(after).toEqual({ ...before, line: 'solid' });
    expect(merged?.edgeKinds.filter((kind) => kind.id !== 'feeds')).toEqual(strategic.edgeKinds.filter((kind) => kind.id !== 'feeds'));
    expect(merged?.nodeKinds).toEqual(strategic.nodeKinds);
  });

  it('неполный новый вид не добавляется и называется', () => {
    const outcome = standardFor('strategic', [{ extends: 'strategic', nodeKinds: [{ id: 'team' }] }]);
    expect(outcome?.standard.nodeKinds.some((kind) => kind.id === 'team')).toBe(false);
    expect(outcome?.problems[0]).toContain('team');
  });

  it('контраст токенов — AA (4,5:1) на странице и карточке обеих тем', () => {
    for (const [name, token] of Object.entries(MAP_TOKENS)) {
      for (const theme of ['light', 'dark'] as const) {
        for (const background of MAP_BACKGROUNDS[theme]) {
          expect(contrastRatio(token[theme], background), `${name} ${theme} на ${background}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it('легенда строится из стандарта: все виды узлов и связей', () => {
    const legend = legendOf(strategic);
    expect(legend.filter((row) => row.kind === 'node').map((row) => row.id)).toEqual(strategic.nodeKinds.map((kind) => kind.id));
    expect(legend.find((row) => row.id === 'feeds')).toMatchObject({ kind: 'edge', line: 'dashed', label: 'format' });
  });
});

describe('линтер карт (V-0151)', () => {
  const known = new Map([['a', { id: 'a', title: 'А', summary: 'есть' }], ['note', { id: 'note', kind: 'person', title: 'Аня', summary: 'роль' }]]);

  it('каждая структурная беда — ошибка с местом', () => {
    const text = '{\n  "id": "b"\n}\n{\n  "from": "a",\n  "to": "zzz"\n}';
    const findings = lintGraph({
      nodes: [{ id: 'b' }, { id: 'c', title: 'Ц', summary: 'есть', kind: 'robot' }],
      edges: [{ from: 'a', to: 'zzz', kind: 'depends' }, { from: 'a', to: 'b', kind: 'loves' }, { from: 'a', to: 'b', kind: 'feeds' }],
      known,
      text
    }, strategic);
    const codes = findings.map((item) => `${item.code}:${item.target}:${item.field}`);
    expect(codes).toEqual(expect.arrayContaining([
      'map_lint_field:b:title', 'map_lint_field:b:summary', 'map_lint_node_kind:c:kind',
      'map_lint_dangling:a → zzz:to', 'map_lint_edge_kind:a → b:kind', 'map_lint_label:a → b:label'
    ]));
    expect(findings.every((item) => item.severity === 'error')).toBe(true);
    expect(findings.find((item) => item.target === 'b')?.line).toBe(2);
    expect(findings.find((item) => item.target === 'a → zzz')?.line).toBe(5);
  });

  it('вложенность в не-контейнер — предупреждение, не ошибка', () => {
    const findings = lintGraph({ nodes: [{ id: 'd', title: 'Д', summary: 'есть', parent: 'note' }], edges: [], known }, strategic);
    expect(findings).toEqual([expect.objectContaining({ severity: 'warning', code: 'map_lint_container' })]);
  });

  it('отметка состояния (только id и status) складывается с прежним узлом и проходит', () => {
    expect(lintStrategicChange({ added: { capabilities: [{ id: 'a' }] } }, { capabilities: [...known.values()] }, strategic)).toEqual([]);
  });
});

describe('линтер в проверке: только записи на подтверждении', () => {
  const manifest = { contract: 'docdd.workspace/1', project: { id: 'demo', name: 'Demo' }, paths: { maps: 'maps' } };
  const map = (id: string, status: string, capability: Record<string, string>): SourceFile => ({
    source: { path: `docs/development/maps/${id}-m.md` },
    text: `---\nid: ${id}\ntype: map\ntitle: Карта\nstatus: ${status}\ncreated: 2026-11-23\nupdated: 2026-11-23\n---\n\n# Карта\n\n\`\`\`docdd-functional\n${JSON.stringify({ added: { capabilities: [capability] } }, null, 2)}\n\`\`\`\n\n## Журнал\n\n- 2026-11-23 · заведена · тест\n`
  });
  const lint = (files: SourceFile[]) => analyze({ files, manifest, readSource: (path) => files.find((item) => item.source.path === path)?.text ?? null }).violations.filter((item) => item.code.startsWith('map_lint'));

  it('черновик без назначения — ошибка map_lint со строкой', () => {
    const found = lint([map('M-0001', 'draft', { id: 'x', title: 'Икс' })]);
    expect(found).toEqual([expect.objectContaining({ code: 'map_lint', id: 'M-0001' })]);
    // Строка файла, а не тела: front matter — восемь строк.
    expect(found[0]?.message).toContain('Строка 17.');
  });

  it('подтверждённая старая запись без назначения не трогается', () => {
    expect(lint([map('M-0001', 'approved', { id: 'x', title: 'Икс' })])).toEqual([]);
  });
});
