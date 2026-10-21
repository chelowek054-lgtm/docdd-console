// V-0054
import { describe, expect, it } from 'vitest';

import type { DesignComponent } from '../server/lib/design';
import { buildCatalogReport, catalogPath, catalogSources, parseCatalog, REFERENCE_STACK } from '../server/lib/design-catalog';

/**
 * Проверка по тексту R-0054: консоль читает index.json (entries v5 и stories
 * прежних версий), сопоставляет истории компонентам реестра, показывает, каких
 * историй не хватает, а несоответствие — нарушение. Storybook не запускается.
 */

const v5 = JSON.stringify({ v: 5, entries: {
  'components-button--solid': { id: 'components-button--solid', type: 'story', title: 'Components/Button', name: 'Solid' },
  'components-button--outline-disabled': { id: 'components-button--outline-disabled', type: 'story', title: 'Components/Button', name: 'Outline Disabled' },
  'components-button--docs': { id: 'components-button--docs', type: 'docs', title: 'Components/Button', name: 'Docs' },
  'components-ghost--primary': { id: 'components-ghost--primary', type: 'story', title: 'Components/Ghost', name: 'Primary' }
} });
const v4 = JSON.stringify({ v: 3, stories: { 'button--solid': { id: 'button--solid', kind: 'Button', story: 'Solid' } } });

const button: DesignComponent = { name: 'Button', variants: ['solid', 'outline'], states: ['default', 'disabled'] };
const src = (text: string | null, stack = REFERENCE_STACK) => ({ stack, label: stack, path: 'sb/index.json', text });

describe('чтение index.json', () => {
  it('v5 entries: истории есть, страницы docs не входят, компонент — последний сегмент title', () => {
    const c = parseCatalog(v5);
    expect(c.state).toBe('ok');
    expect(c.stories.map((s) => s.id)).toEqual(['components-button--solid', 'components-button--outline-disabled', 'components-ghost--primary']);
    expect(c.stories[0]!.component).toBe('Button');
  });

  it('прежний формат stories (kind/story) читается', () => {
    const c = parseCatalog(v4);
    expect(c.stories).toEqual([{ id: 'button--solid', title: 'Button', name: 'Solid', component: 'Button', props: null }]);
  });

  it('нет файла, не JSON, нет entries/stories — состояния без падения', () => {
    expect(parseCatalog(null).state).toBe('missing');
    expect(parseCatalog('{oops').state).toBe('invalid');
    expect(parseCatalog('{"a":1}').state).toBe('invalid');
    expect(parseCatalog('[]').state).toBe('invalid');
  });

  it('props берутся из argTypes, иначе из args; нет — null', () => {
    const c = parseCatalog(JSON.stringify({ entries: {
      a: { id: 'a', title: 'X', name: 'A', argTypes: { size: {} }, args: { other: 1 } },
      b: { id: 'b', title: 'X', name: 'B', args: { tone: 1 } },
      c: { id: 'c', title: 'X', name: 'C' }
    } }));
    expect(c.stories.map((s) => s.props)).toEqual([['size'], ['tone'], null]);
  });

  it('путь: файл json как есть, каталог — с index.json', () => {
    expect(catalogPath('sb/index.json')).toBe('sb/index.json');
    expect(catalogPath('sb\\static\\')).toBe('sb/static/index.json');
  });

  it('пути за пределами корня не читаются', () => {
    const read = () => 'SHOULD_NOT_READ';
    for (const bad of ['../x', '/abs/x', 'C:/x', 'a/../../x']) {
      expect(catalogSources({ catalog: bad }, {}, read)[0]?.text).toBeNull();
    }
    expect(catalogSources({ catalog: 'ok' }, {}, read)[0]?.text).toBe('SHOULD_NOT_READ');
  });
});

describe('сопоставление с реестром и пробелы', () => {
  it('история показывает вариант/состояние по словам имени; пробелы — design_story_missing', () => {
    const r = buildCatalogReport([button], [src(v5)]);
    const cell = (item: string) => r.rows.find((row) => row.item === item)!.cells[0]!.stories;
    expect(cell('solid')).toEqual(['components-button--solid']);
    expect(cell('disabled')).toEqual(['components-button--outline-disabled']);
    expect(cell('outline')).toEqual(['components-button--outline-disabled']);
    expect(cell('default')).toEqual([]);
    const missing = r.findings.filter((f) => f.code === 'design_story_missing');
    expect(missing).toHaveLength(1);
    expect(missing[0]!.message).toContain('`default`');
    expect(r.storiesOf['Button']![REFERENCE_STACK]).toHaveLength(2);
  });

  it('компонент без вариантов и состояний обязан иметь хоть одну историю', () => {
    const r = buildCatalogReport([{ name: 'Badge' }], [src(v5)]);
    expect(r.findings.some((f) => f.component === 'Badge' && f.code === 'design_story_missing')).toBe(true);
    expect(buildCatalogReport([{ name: 'Button' }], [src(v5)]).findings.filter((f) => f.component === 'Button')).toEqual([]);
  });

  it('имена сравниваются как слова: IconButton = icon-button', () => {
    const text = JSON.stringify({ entries: { a: { id: 'a', title: 'UI/icon-button', name: 'Disabled' } } });
    const r = buildCatalogReport([{ name: 'IconButton', states: ['disabled'] }], [src(text)]);
    expect(r.findings).toEqual([]);
  });

  it('история компонента вне реестра — design_contract_drift', () => {
    const r = buildCatalogReport([button], [src(v5)]);
    expect(r.findings.find((f) => f.code === 'design_contract_drift')).toMatchObject({ component: 'Ghost' });
  });

  it('каталог назван, а файла нет или он битый — нарушение каталога', () => {
    for (const text of [null, '{oops']) {
      const r = buildCatalogReport([button], [src(text)]);
      expect(r.findings).toHaveLength(1);
      expect(r.findings[0]).toMatchObject({ code: 'design_story_missing', component: '' });
      expect(r.columns[0]!.state).not.toBe('ok');
    }
  });

  it('каталоги не объявлены — источников нет, отчёта нет', () => {
    expect(catalogSources(undefined, {}, () => 'x')).toEqual([]);
    expect(catalogSources({}, {}, () => 'x')).toEqual([]);
  });
});
