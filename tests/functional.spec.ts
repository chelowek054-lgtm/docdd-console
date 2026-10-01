import { describe, expect, it } from 'vitest';

import {
  capabilityLines,
  dependsCycle,
  derivedStatus,
  drawableRelations,
  filterByStatus,
  overallProgress,
  parseFunctionalCheck,
  statesOf,
  statusDeclarations,
  waitingOn,
  withMarks,
  type CapabilityLike
} from '../server/lib/functional';
import { foldMaps, parseMapRecord } from '../server/lib/maps';

/**
 * Состояние реализации и связи функциональной карты (docs/07-maps.md,
 * «Состояние реализации», «Связи между возможностями»).
 */

const tree: CapabilityLike[] = [
  { id: 'orders', title: 'Заказы' },
  { id: 'orders.pay', title: 'Оплата', parent: 'orders', status: 'implemented' },
  { id: 'orders.cancel', title: 'Отмена', parent: 'orders', status: 'partial', note: 'нет возвратов' },
  { id: 'orders.track', title: 'Статус', parent: 'orders' },
  { id: 'account', title: 'Аккаунт', status: 'not_implemented' }
];

describe('состояние родителя — производное', () => {
  it('все реализованы — реализовано, ни одного — не реализовано, смесь — частично', () => {
    expect(derivedStatus({ implemented: 2, partial: 0, not_implemented: 0, unrated: 0, total: 2 })).toBe('implemented');
    expect(derivedStatus({ implemented: 0, partial: 0, not_implemented: 3, unrated: 0, total: 3 })).toBe('not_implemented');
    expect(derivedStatus({ implemented: 1, partial: 0, not_implemented: 1, unrated: 0, total: 2 })).toBe('partial');
    expect(derivedStatus({ implemented: 0, partial: 1, not_implemented: 0, unrated: 0, total: 1 })).toBe('partial');
  });

  it('не оценённые листья в расчёт не идут, но считаются отдельно', () => {
    const states = statesOf(tree);
    // implemented + partial, один лист не оценён → частично; счёт называет всех.
    expect(states.get('orders')).toEqual({
      status: 'partial',
      progress: { implemented: 1, partial: 1, not_implemented: 0, unrated: 1, total: 3 }
    });
    expect(states.get('orders.pay')).toEqual({ status: 'implemented', progress: null });
  });

  it('ни одного оценённого листа — не оценено, а не «не реализовано»', () => {
    const states = statesOf([{ id: 'a' }, { id: 'b', parent: 'a' }]);
    expect(states.get('a')?.status).toBeNull();
  });

  it('собственное состояние родителя экран не показывает', () => {
    const states = statesOf([
      { id: 'a', status: 'implemented' },
      { id: 'b', parent: 'a', status: 'not_implemented' }
    ]);
    expect(states.get('a')?.status).toBe('not_implemented');
  });

  it('общий счёт — по нижним возможностям', () => {
    expect(overallProgress(tree)).toEqual({ implemented: 1, partial: 1, not_implemented: 1, unrated: 1, total: 4 });
  });

  it('цикл в parent не зависает', () => {
    expect(() => statesOf([{ id: 'a', parent: 'b' }, { id: 'b', parent: 'a' }])).not.toThrow();
  });
});

describe('фильтр по состоянию', () => {
  it('оставляет подходящие листья и их предков', () => {
    const ids = filterByStatus(tree, 'partial').map((item) => item.id);
    expect(ids).toEqual(['orders', 'orders.cancel']);
  });

  it('«не оценено» — тоже фильтр', () => {
    const ids = filterByStatus(tree, 'unrated').map((item) => item.id);
    expect(ids).toEqual(['orders', 'orders.track']);
  });

  it('без фильтра — всё', () => {
    expect(filterByStatus(tree, null)).toHaveLength(tree.length);
  });
});

describe('несохранённые отметки поверх картины', () => {
  it('меняют состояние и note, не трогая остальное', () => {
    const next = withMarks(tree, { 'orders.track': { status: 'implemented', note: 'готово' } });
    expect(next.find((item) => item.id === 'orders.track')).toMatchObject({
      status: 'implemented', note: 'готово', title: 'Статус', parent: 'orders'
    });
    expect(tree.find((item) => item.id === 'orders.track')?.status).toBeUndefined();
  });

  it('null снимает отметку вместе с note', () => {
    const next = withMarks(tree, { 'orders.cancel': { status: null } });
    const item = next.find((candidate) => candidate.id === 'orders.cancel');
    expect(item?.status).toBeUndefined();
    expect(item?.note).toBeUndefined();
  });

  it('note, которого в отметке нет, остаётся прежним', () => {
    const next = withMarks(tree, { 'orders.cancel': { status: 'implemented' } });
    expect(next.find((item) => item.id === 'orders.cancel')?.note).toBe('нет возвратов');
  });
});

describe('связи', () => {
  it('«ждёт»: не реализована сама, а зависимость тоже', () => {
    const caps: CapabilityLike[] = [
      { id: 'a', status: 'partial' }, { id: 'b', status: 'not_implemented' },
      { id: 'c', status: 'implemented' }, { id: 'd', status: 'not_implemented' }
    ];
    const waiting = waitingOn(caps, [
      { from: 'a', to: 'b', type: 'depends' },
      // Зависимость реализована — ждать нечего.
      { from: 'd', to: 'c', type: 'depends' },
      // `uses` не блокирует.
      { from: 'a', to: 'd', type: 'uses' }
    ]);
    expect([...waiting]).toEqual([['a', ['b']]]);
  });

  it('реализованная возможность не ждёт, даже если зависимость отстала', () => {
    const waiting = waitingOn(
      [{ id: 'a', status: 'implemented' }, { id: 'b', status: 'not_implemented' }],
      [{ from: 'a', to: 'b', type: 'depends' }]
    );
    expect(waiting.size).toBe(0);
  });

  it('цикл по depends находит обе стороны; цепочка — нет', () => {
    expect([...dependsCycle([
      { from: 'a', to: 'b', type: 'depends' },
      { from: 'b', to: 'a', type: 'depends' },
      { from: 'b', to: 'c', type: 'depends' }
    ])].sort()).toEqual(['a', 'b']);
    expect(dependsCycle([{ from: 'a', to: 'b', type: 'depends' }]).size).toBe(0);
  });

  it('цикл по uses циклом не считается', () => {
    expect(dependsCycle([{ from: 'a', to: 'b', type: 'uses' }, { from: 'b', to: 'a', type: 'uses' }]).size).toBe(0);
  });

  it('нерисуемые: нет конца, связь с самой собой, с предком, незнакомый вид', () => {
    const { drawn, skipped } = drawableRelations([
      { from: 'orders', to: 'account', type: 'uses' },
      { from: 'orders', to: 'нет', type: 'uses' },
      { from: 'orders.pay', to: 'orders', type: 'depends' },
      { from: 'account', to: 'account', type: 'depends' },
      { from: 'orders', to: 'account', type: 'replaces' }
    ], tree);
    expect(drawn).toHaveLength(1);
    expect(skipped).toBe(4);
  });
});

describe('карта: состояние и связи проходят схему и складываются', () => {
  const body = (change: unknown) => ['```docdd-functional', JSON.stringify(change), '```'].join('\n');

  it('status, note и relations читаются', () => {
    const parsed = parseMapRecord(body({
      added: {
        capabilities: [{ id: 'a', status: 'partial', note: 'нет возвратов' }],
        relations: [{ from: 'a', to: 'b', type: 'depends', summary: 'нужен вход' }]
      }
    }));
    expect(parsed.problems).toEqual([]);
    expect(parsed.change.functional?.added?.relations).toHaveLength(1);
  });

  it('незнакомое состояние и вид связи схема отвергает', () => {
    expect(parseMapRecord(body({ added: { capabilities: [{ id: 'a', status: 'almost' }] } })).problems).toHaveLength(1);
    expect(parseMapRecord(body({ added: { relations: [{ from: 'a', to: 'b', type: 'replaces' }] } })).problems).toHaveLength(1);
  });

  it('повторное объявление — уточнение: состояние побеждает последнее, связь с другим типом — другая связь', () => {
    const folded = foldMaps([
      { id: 'M-0001', change: { functional: { added: {
        capabilities: [{ id: 'a', title: 'А' }],
        relations: [{ from: 'a', to: 'b', type: 'depends' }]
      } } } },
      { id: 'M-0002', change: { functional: { added: {
        capabilities: [{ id: 'a', title: 'А', status: 'implemented' }],
        relations: [{ from: 'a', to: 'b', type: 'feeds' }]
      } } } }
    ]);
    expect(folded.functional.capabilities).toHaveLength(1);
    expect(folded.functional.capabilities[0]).toMatchObject({ status: 'implemented', declaredBy: 'M-0002' });
    expect(folded.functional.relations.map((relation) => relation.type)).toEqual(['depends', 'feeds']);
  });

  it('removed убирает связь по тройке', () => {
    const folded = foldMaps([
      { id: 'M-0001', change: { functional: { added: { relations: [{ from: 'a', to: 'b', type: 'depends' }] } } } },
      { id: 'M-0002', change: { functional: { removed: { relations: [{ from: 'a', to: 'b', type: 'depends' }] } } } }
    ]);
    expect(folded.functional.relations).toEqual([]);
  });
});

describe('statusDeclarations — пачка отметок', () => {
  it('объявляет возможность целиком, меняя только состояние и note', () => {
    const { declarations, unknown } = statusDeclarations(tree, [
      { id: 'orders.cancel', status: 'implemented' },
      { id: 'orders.track', status: 'partial', note: ' ждёт сроков ' }
    ]);
    expect(unknown).toEqual([]);
    expect(declarations).toEqual([
      { id: 'orders.cancel', title: 'Отмена', parent: 'orders', status: 'implemented', note: 'нет возвратов' },
      { id: 'orders.track', title: 'Статус', parent: 'orders', status: 'partial', note: 'ждёт сроков' }
    ]);
  });

  it('null снимает состояние и note, остальные поля остаются', () => {
    const { declarations } = statusDeclarations(tree, [{ id: 'orders.cancel', status: null }]);
    expect(declarations).toEqual([{ id: 'orders.cancel', title: 'Отмена', parent: 'orders' }]);
  });

  it('возможности нет в картине — в unknown, а не молча', () => {
    expect(statusDeclarations(tree, [{ id: 'нет', status: 'partial' }]).unknown).toEqual(['нет']);
  });

  it('повтор id — первое слово, один раз', () => {
    const { declarations } = statusDeclarations(tree, [
      { id: 'account', status: 'partial' },
      { id: 'account', status: 'implemented' }
    ]);
    expect(declarations).toHaveLength(1);
    expect(declarations[0]?.status).toBe('partial');
  });
});

describe('parseFunctionalCheck — ответ «Проверить по коду»', () => {
  const answer = (checks: unknown) => ['Вот.', '```docdd-functional-check', JSON.stringify({ checks }), '```'].join('\n');

  it('сопоставляет предложение с тем, что в картине сейчас', () => {
    const result = parseFunctionalCheck(answer([
      { id: 'orders.cancel', status: 'implemented', note: ' возвраты есть ' },
      { id: 'orders.track', status: 'not_implemented', note: '' }
    ]), tree);
    expect(result?.checks).toEqual([
      { id: 'orders.cancel', title: 'Отмена', current: 'partial', proposed: 'implemented', note: 'возвраты есть' },
      { id: 'orders.track', title: 'Статус', current: null, proposed: 'not_implemented', note: '' }
    ]);
    expect(result?.skipped).toEqual([]);
  });

  it('родитель, чужой id и незнакомое состояние — в skipped с причиной', () => {
    const result = parseFunctionalCheck(answer([
      { id: 'orders', status: 'implemented' },
      { id: 'нет', status: 'implemented' },
      { id: 'account', status: 'maybe' }
    ]), tree);
    expect(result?.checks).toEqual([]);
    expect(result?.skipped.map((row) => row.id)).toEqual(['orders', 'нет', 'account']);
    expect(result?.skipped[0]?.reason).toContain('производное');
  });

  it('блока нет или он не JSON — null: экран покажет текст', () => {
    expect(parseFunctionalCheck('просто текст', tree)).toBeNull();
    expect(parseFunctionalCheck('```docdd-functional-check\n{не json\n```', tree)).toBeNull();
    expect(parseFunctionalCheck('```docdd-functional-check\n{"x":1}\n```', tree)).toBeNull();
  });
});

describe('capabilityLines — дерево для запроса', () => {
  it('рядом с каждой возможностью её отметка, глубина — отступом', () => {
    const text = capabilityLines(tree);
    expect(text).toContain('- `orders` — Заказы (не оценено)');
    expect(text).toContain('  - `orders.cancel` — Отмена (partial; нет возвратов)');
    expect(text).toContain('- `account` — Аккаунт (not_implemented)');
  });
});
