// V-0055
import { describe, expect, it } from 'vitest';

import { resolveDesign } from '../server/lib/design';
import type { DesignComponent } from '../server/lib/design';
import { buildCatalogReport, catalogSources, REFERENCE_STACK } from '../server/lib/design-catalog';
import { designCatalogRules } from '../server/lib/rules';
import { context } from './helpers';

/**
 * Проверка по тексту R-0055: для каждого объявленного стека каждый компонент
 * контракта в каждом состоянии имеет историю или превью (design_story_missing),
 * свойства совпадают с контрактом (design_contract_drift); матрица
 * «компонент × состояние × стек»; правила срабатывают на образце.
 */

const catalog = (entries: Record<string, [string, string, string[]?]>): string => JSON.stringify({ v: 5, entries: Object.fromEntries(
  Object.entries(entries).map(([id, [title, name, args]]) => [id, { id, type: 'story', title, name, ...(args ? { args: Object.fromEntries(args.map((a) => [a, 1])) } : {}) }])
) });

const button: DesignComponent = {
  name: 'Button', states: ['default', 'disabled'],
  props: [{ name: 'size', type: 'string' }, { name: 'label', type: 'string', required: true }]
};

const web = catalog({ 'b-default': ['Components/Button', 'Default', ['size', 'label']], 'b-disabled': ['Components/Button', 'Disabled', ['size', 'label']] });
const expo = catalog({ 'e-default': ['Button', 'Default', ['size', 'label']], 'e-disabled': ['Button', 'Disabled', ['size', 'label']] });
const compose = catalog({ 'c-default': ['Button', 'Default', ['size', 'label']] });
const swift = catalog({ 's-default': ['Button', 'Default', ['size', 'tint']], 's-disabled': ['Button', 'Disabled', ['size', 'tint']] });

const sources = [
  { stack: REFERENCE_STACK, label: 'Storybook проекта', path: 'sb/index.json', text: web },
  { stack: 'expo', label: 'Expo', path: 'expo/index.json', text: expo },
  { stack: 'compose', label: 'Compose', path: 'compose/index.json', text: compose },
  { stack: 'swiftui', label: 'SwiftUI', path: 'swift/index.json', text: swift }
];

describe('матрица компонент × состояние × стек', () => {
  const r = buildCatalogReport([button], sources);

  it('строка на каждое состояние, столбец на каждый каталог, ячейка — список историй', () => {
    expect(r.columns.map((c) => c.stack)).toEqual([REFERENCE_STACK, 'expo', 'compose', 'swiftui']);
    expect(r.rows.map((row) => `${row.component}/${row.item}/${row.kind}`)).toEqual(['Button/default/state', 'Button/disabled/state']);
    const disabled = r.rows[1]!;
    expect(disabled.cells.map((c) => [c.stack, c.stories.length])).toEqual([[REFERENCE_STACK, 1], ['expo', 1], ['compose', 0], ['swiftui', 1]]);
  });

  it('design_story_missing только там, где истории нет', () => {
    const miss = r.findings.filter((f) => f.code === 'design_story_missing');
    expect(miss).toHaveLength(1);
    expect(miss[0]).toMatchObject({ stack: 'compose', component: 'Button' });
    expect(miss[0]!.message).toContain('disabled');
  });

  it('design_contract_drift: свойство вне контракта и нет обязательного', () => {
    const drift = r.findings.filter((f) => f.code === 'design_contract_drift');
    expect(drift.map((f) => f.stack)).toEqual(['swiftui', 'swiftui']);
    expect(drift.map((f) => f.message).join('\n')).toContain('`tint`');
    expect(drift.map((f) => f.message).join('\n')).toContain('`label`');
  });

  it('выгрузка без args/argTypes не порождает расхождений свойств', () => {
    const plain = catalog({ 'x-default': ['Button', 'Default'], 'x-disabled': ['Button', 'Disabled'] });
    const out = buildCatalogReport([button], [{ ...sources[1]!, text: plain }]);
    expect(out.findings).toEqual([]);
  });

  it('необязательное свойство, которого нет в историях, расхождением не считается', () => {
    const only = catalog({ 'x-default': ['Button', 'Default', ['label']], 'x-disabled': ['Button', 'Disabled', ['label']] });
    expect(buildCatalogReport([button], [{ ...sources[1]!, text: only }]).findings).toEqual([]);
  });
});

describe('правила на образце проекта', () => {
  const tokens = '```docdd-design\n' + JSON.stringify({ unit: 'rem', components: [button] }) + '\n```';
  const design = resolveDesign({ general: [], local: [{ id: 'D-1', body: tokens }] });
  const files = Object.fromEntries(sources.map((s) => [s.path, s.text]));
  const ctx = (extra: Record<string, unknown>) => ({ ...context([], { sources: files as Record<string, string> }), design, ...extra });

  it('включается манифестом: без design.catalog и stacks[].catalog правил нет', () => {
    expect(designCatalogRules(ctx({}) as never)).toEqual([]);
  });

  it('образец даёт design_story_missing и design_contract_drift', () => {
    const out = designCatalogRules(ctx({
      designCatalog: 'sb/index.json',
      designStacks: [{ id: 'expo', catalog: 'expo/index.json' }, { id: 'compose', catalog: 'compose/index.json' }, { id: 'swiftui', catalog: 'swift/index.json' }]
    }) as never);
    expect(out.map((v) => v.code).sort()).toEqual(['design_contract_drift', 'design_contract_drift', 'design_story_missing']);
  });

  it('читаются каталоги только объявленных стеков', () => {
    const list = catalogSources({ catalog: 'sb', stacks: [{ id: 'expo', catalog: 'expo/index.json' }, { id: 'compose' }] }, {}, (p) => files[p] ?? null);
    expect(list.map((s) => s.stack)).toEqual([REFERENCE_STACK, 'expo']);
  });
});
