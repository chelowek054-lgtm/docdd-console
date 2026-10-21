// V-0053
import { describe, expect, it } from 'vitest';

import { resolveDesign, type DesignRecord } from '../server/lib/design';
import { compositionProblems, parseContract } from '../server/lib/design-contract';

/**
 * Проверка по тексту R-0053: контракт компонента (уровень, из чего собран,
 * варианты, состояния, свойства с типами и умолчаниями, слоты, события, logic)
 * входит в блок `docdd-design` и проверяется.
 */

const rec = (id: string, components: unknown[]): DesignRecord => ({ id, body: '```docdd-design\n' + JSON.stringify({ unit: 'rem', components }) + '\n```' });
const messages = (components: unknown[]): string[] => {
  const resolved = resolveDesign({ general: [rec('D-1', components)], local: [] });
  return resolved.problems.map((item) => item.message);
};

const button = {
  name: 'Button', kind: 'base', variants: ['solid', 'outline'], states: ['default', 'disabled'],
  props: [{ name: 'size', type: "'sm' | 'md'", default: 'md', values: ['sm', 'md'] }, { name: 'loading', type: 'boolean', default: false, required: true }],
  slots: ['icon'], events: ['press']
};
const card = { name: 'Card', kind: 'composite', composedOf: ['Button'], logic: 'сортировка внутри' };

describe('контракт в блоке', () => {
  it('все поля контракта читаются и видны в реестре; без замечаний', () => {
    const r = resolveDesign({ general: [rec('D-1', [button, card])], local: [] });
    expect(messages([button, card])).toEqual([]);
    const b = r.tokens.components.find((c) => c.value.name === 'Button')!.value;
    expect(b).toMatchObject({ kind: 'base', variants: ['solid', 'outline'], states: ['default', 'disabled'], slots: ['icon'], events: ['press'] });
    expect(b.props).toEqual([
      { name: 'size', type: "'sm' | 'md'", default: 'md', values: ['sm', 'md'] },
      { name: 'loading', type: 'boolean', default: 'false', required: true }
    ]);
    const c = r.tokens.components.find((x) => x.value.name === 'Card')!.value;
    expect(c).toMatchObject({ kind: 'composite', composedOf: ['Button'], logic: 'сортировка внутри' });
  });

  it('бизнес-логики нет по умолчанию: поле logic не появляется само', () => {
    expect(parseContract({ name: 'X' }, () => undefined).logic).toBeUndefined();
  });

  it('схема: уровень не из списка, базовый с composedOf, составной без него', () => {
    expect(messages([{ name: 'A', kind: 'huge' }]).join()).toContain('уровень');
    expect(messages([{ name: 'A', kind: 'base', composedOf: ['B'] }, { name: 'B' }]).join()).toContain('базовый');
    expect(messages([{ name: 'A', kind: 'composite' }]).join()).toContain('составной');
  });

  it('схема: свойство без name/type, списки не строками, logic не строкой', () => {
    const out = messages([{ name: 'A', props: [{ name: 'x' }, { type: 'string' }, 'y'], variants: 'solid', slots: 1, logic: 5 }]);
    expect(out.filter((m) => m.includes('нужны `name` и `type`'))).toHaveLength(3);
    expect(out.join()).toContain('`variants` должен быть списком');
    expect(out.join()).toContain('`slots` должен быть списком');
    expect(out.join()).toContain('`logic`');
    expect(messages([{ name: 'A', props: 'x' }]).join()).toContain('`props` должен быть списком');
  });

  it('пустое logic — не пояснение', () => {
    expect(messages([{ name: 'A', logic: '  ' }]).join()).toContain('`logic`');
  });

  it('незнакомые поля записи компонента не мешают', () => {
    expect(messages([{ name: 'A', figma: 'abc', kind: 'base' }])).toEqual([]);
  });
});

describe('состав: неизвестное и круг', () => {
  it('ссылка на неизвестный компонент — замечание', () => {
    expect(compositionProblems([{ name: 'Card', composedOf: ['Ghost'] }]).join()).toContain('Ghost');
    expect(messages([{ name: 'Card', kind: 'composite', composedOf: ['Ghost'] }]).join()).toContain('Ghost');
  });

  it('круг и самоссылка называются; без круга чисто, ромб не круг', () => {
    expect(compositionProblems([{ name: 'A', composedOf: ['B'] }, { name: 'B', composedOf: ['A'] }]).join()).toContain('по кругу');
    expect(compositionProblems([{ name: 'A', composedOf: ['A'] }]).join()).toContain('по кругу');
    expect(compositionProblems([
      { name: 'Top', composedOf: ['L', 'R'] }, { name: 'L', composedOf: ['Base'] }, { name: 'R', composedOf: ['Base'] }, { name: 'Base' }
    ])).toEqual([]);
  });

  it('длинный круг через три компонента находится', () => {
    const out = compositionProblems([{ name: 'A', composedOf: ['B'] }, { name: 'B', composedOf: ['C'] }, { name: 'C', composedOf: ['A'] }]);
    expect(out.length).toBeGreaterThan(0);
    expect(out[0]).toContain('A → B → C → A');
  });
});
