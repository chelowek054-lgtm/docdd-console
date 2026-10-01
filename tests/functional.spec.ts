import { describe, expect, it } from 'vitest';

import {
  applyMarks, stateOfTally, summarize, tallyText, visibleUnder,
  type CapabilityItem
} from '../server/lib/functional';
import { foldMaps, parseMapRecord } from '../server/lib/maps';
import { validateFunctional } from '../server/lib/schema';

/**
 * Состояние реализации возможностей (docs/07-maps.md, «Состояние реализации»).
 */

function cap(id: string, parent?: string, status?: string): CapabilityItem & { status?: never } & Record<string, unknown> {
  return { id, parent, status } as never;
}

const TREE = [
  cap('orders'),
  cap('orders.pay', 'orders', 'implemented'),
  cap('orders.refund', 'orders', 'not_implemented'),
  cap('orders.cancel', 'orders', 'partial'),
  cap('orders.export', 'orders'),
  cap('login', undefined, 'implemented')
];

describe('summarize', () => {
  it('нижняя возможность несёт своё состояние, а «не оценено» — отсутствие поля', () => {
    const { byId } = summarize(TREE);
    expect(byId.get('orders.pay')).toMatchObject({ leaf: true, state: 'implemented' });
    expect(byId.get('orders.refund')).toMatchObject({ leaf: true, state: 'not_implemented' });
    expect(byId.get('orders.export')).toMatchObject({ leaf: true, state: 'unassessed' });
  });

  it('родитель считается по нижним, а не по своему полю', () => {
    const { byId } = summarize([
      cap('a', undefined, 'implemented'),
      cap('a.1', 'a', 'not_implemented'),
      cap('a.2', 'a')
    ]);
    const parent = byId.get('a');
    expect(parent?.leaf).toBe(false);
    // Собственный `implemented` у родителя не читается: возможность могла быть нижней, когда её отметили.
    expect(parent?.state).toBe('partial');
    expect(parent?.tally).toEqual({ implemented: 0, partial: 0, not_implemented: 1, unassessed: 1, total: 2 });
  });

  it('вложенность любой глубины считает только нижние', () => {
    const { byId, overall } = summarize([
      cap('a'), cap('a.1', 'a'), cap('a.1.x', 'a.1', 'implemented'), cap('a.1.y', 'a.1', 'implemented'), cap('a.2', 'a', 'implemented')
    ]);
    expect(byId.get('a')?.tally.total).toBe(3);
    expect(byId.get('a')?.state).toBe('implemented');
    expect(overall.total).toBe(3);
  });

  it('общий счёт — по всем нижним возможностям карты разом', () => {
    expect(summarize(TREE).overall).toEqual({ implemented: 2, partial: 1, not_implemented: 1, unassessed: 1, total: 5 });
  });

  it('родитель, которого в списке нет, и круг из parent читаются как верхний уровень', () => {
    const orphan = summarize([cap('x', 'нет-такого', 'partial')]);
    expect(orphan.byId.get('x')).toMatchObject({ leaf: true, state: 'partial' });

    const circle = summarize([cap('a', 'b', 'implemented'), cap('b', 'a', 'implemented')]);
    // Нижних в круге нет — и считать нечего, но и зависнуть нельзя.
    expect(circle.overall.total).toBe(0);
    expect(circle.byId.get('a')?.state).toBe('unassessed');
  });

  it('несохранённая отметка подменяет состояние без правки данных', () => {
    const { overall } = summarize(TREE, (item) => (item.id === 'orders.export' ? 'implemented' : item.status));
    expect(overall.implemented).toBe(3);
    expect(overall.unassessed).toBe(0);
  });
});

describe('stateOfTally', () => {
  const tally = (implemented: number, partial: number, not_implemented: number, unassessed: number) => ({
    implemented, partial, not_implemented, unassessed, total: implemented + partial + not_implemented + unassessed
  });

  it('все реализованы — реализовано, все нереализованы — не реализовано', () => {
    expect(stateOfTally(tally(3, 0, 0, 0))).toBe('implemented');
    expect(stateOfTally(tally(0, 0, 2, 0))).toBe('not_implemented');
  });

  it('ни одна не оценена или нижних нет — не оценено', () => {
    expect(stateOfTally(tally(0, 0, 0, 4))).toBe('unassessed');
    expect(stateOfTally(tally(0, 0, 0, 0))).toBe('unassessed');
  });

  it('всё прочее — частично: и реализованное с неоценённым', () => {
    expect(stateOfTally(tally(2, 0, 0, 1))).toBe('partial');
    expect(stateOfTally(tally(1, 0, 1, 0))).toBe('partial');
    expect(stateOfTally(tally(0, 2, 0, 0))).toBe('partial');
  });
});

describe('tallyText', () => {
  it('нулевые доли молчат', () => {
    expect(tallyText({ implemented: 5, partial: 0, not_implemented: 1, unassessed: 2, total: 8 }))
      .toBe('5 из 8 реализовано, 1 не реализовано, 2 не оценено');
    expect(tallyText({ implemented: 0, partial: 0, not_implemented: 0, unassessed: 0, total: 0 }))
      .toBe('нижних возможностей нет');
  });
});

describe('visibleUnder', () => {
  it('под фильтром видны нижние этого состояния и все их предки', () => {
    const visible = visibleUnder(TREE, summarize(TREE), 'not_implemented');
    expect([...(visible ?? [])].sort()).toEqual(['orders', 'orders.refund']);
  });

  it('без фильтра видно всё — null, а не пустое множество', () => {
    expect(visibleUnder(TREE, summarize(TREE), null)).toBeNull();
  });

  it('родитель в фильтр не попадает сам по себе, только как предок найденного', () => {
    const visible = visibleUnder(TREE, summarize(TREE), 'unassessed');
    expect(visible?.has('login')).toBe(false);
    expect(visible?.has('orders')).toBe(true);
  });
});

describe('applyMarks', () => {
  const current = [
    { id: 'orders.pay', title: 'Оплата', parent: 'orders', summary: 'Платёж картой', note: 'старое', declaredBy: 'M-0001', pending: false },
    { id: 'orders.refund', title: 'Возврат', parent: 'orders', declaredBy: 'M-0001' }
  ];

  it('отметка несёт все поля возможности: повторное объявление заменяет элемент целиком', () => {
    const { items } = applyMarks(current, [{ id: 'orders.pay', status: 'partial' }]);
    expect(items).toEqual([
      { id: 'orders.pay', title: 'Оплата', parent: 'orders', summary: 'Платёж картой', status: 'partial', note: 'старое' }
    ]);
  });

  it('declaredBy и pending в черновик не попадают: схема их не знает', () => {
    const { items } = applyMarks(current, [{ id: 'orders.refund', status: 'implemented' }]);
    expect(items[0]).not.toHaveProperty('declaredBy');
    expect(items[0]).not.toHaveProperty('pending');
    expect(validateFunctional({ added: { capabilities: items } })).toEqual([]);
  });

  it('note: нет в отметке — прежняя; текст — заменяет; пустая строка — снимает', () => {
    expect(applyMarks(current, [{ id: 'orders.pay', status: 'implemented' }]).items[0]?.note).toBe('старое');
    expect(applyMarks(current, [{ id: 'orders.pay', status: 'implemented', note: ' готово ' }]).items[0]?.note).toBe('готово');
    expect(applyMarks(current, [{ id: 'orders.pay', status: 'implemented', note: '  ' }]).items[0]).not.toHaveProperty('note');
  });

  it('status: null снимает отметку', () => {
    const marked = [{ id: 'a', status: 'partial' }];
    const { items } = applyMarks(marked as never, [{ id: 'a', status: null }]);
    expect(items[0]).not.toHaveProperty('status');
  });

  it('неизвестный id возвращается отдельно, пачка не принимается наполовину', () => {
    const { items, unknown } = applyMarks(current, [
      { id: 'orders.pay', status: 'implemented' },
      { id: 'нет-такой', status: 'partial' }
    ]);
    expect(unknown).toEqual(['нет-такой']);
    expect(items.map((item) => item.id)).toEqual(['orders.pay']);
  });

  it('дубль в пачке — уточнение: побеждает последняя отметка', () => {
    const { items } = applyMarks(current, [
      { id: 'orders.pay', status: 'partial' },
      { id: 'orders.pay', status: 'implemented' }
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]?.status).toBe('implemented');
  });
});

describe('схема и свёртка', () => {
  it('status и note проходят схему, чужое значение — нет', () => {
    expect(validateFunctional({ added: { capabilities: [{ id: 'a', status: 'partial', note: 'есть половина' }] } })).toEqual([]);
    const issues = validateFunctional({ added: { capabilities: [{ id: 'a', status: 'done' }] } });
    expect(issues.map((issue) => issue.message).join(' ')).toContain('implemented');
  });

  it('отметка в блоке карты разбирается, а новая карта с тем же id уточняет прежнюю', () => {
    const block = (payload: unknown) => ['```docdd-functional', JSON.stringify(payload), '```'].join('\n');
    const first = parseMapRecord(block({ added: { capabilities: [{ id: 'a', title: 'Оплата', summary: 'описание' }] } }));
    const second = parseMapRecord(block({ added: { capabilities: [{ id: 'a', title: 'Оплата', summary: 'описание', status: 'partial', note: 'половина' }] } }));
    expect(first.problems).toEqual([]);
    expect(second.problems).toEqual([]);

    const folded = foldMaps([{ id: 'M-0001', change: first.change }, { id: 'M-0002', change: second.change }]);
    expect(folded.functional.capabilities).toEqual([
      { id: 'a', title: 'Оплата', summary: 'описание', status: 'partial', note: 'половина', declaredBy: 'M-0002' }
    ]);
  });

  it('отметка без остальных полей стирает описание — поэтому они едут вместе', () => {
    const block = (payload: unknown) => ['```docdd-functional', JSON.stringify(payload), '```'].join('\n');
    const first = parseMapRecord(block({ added: { capabilities: [{ id: 'a', title: 'Оплата', summary: 'описание' }] } }));
    const bare = parseMapRecord(block({ added: { capabilities: [{ id: 'a', status: 'partial' }] } }));
    const folded = foldMaps([{ id: 'M-0001', change: first.change }, { id: 'M-0002', change: bare.change }]);
    expect(folded.functional.capabilities[0]?.summary).toBeUndefined();
  });
});
