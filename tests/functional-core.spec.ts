import { describe, expect, it } from 'vitest';

import { consistencyFlags } from '../server/lib/coverage';
import {
  NO_RELATION_MARKS,
  drawableRelations,
  effectiveHorizon,
  effectivePriority,
  filterLeaves,
  functionalGhosts,
  groupLevel,
  groupScopeOf,
  impactOf,
  parseFunctionalRelations,
  planPredicate,
  planRelations,
  queueRelationAdd,
  queueRelationRemove,
  relationLines,
  relationMarkCount,
  reliesOnEdges,
  replacedBy,
  rootOf,
  startNow,
  statusDeclarations,
  unblockCounts,
  withRelationMarks,
  type CapabilityLike,
  type RelationLike
} from '../server/lib/functional';
import { usableRelations } from '../server/lib/inbox';
import { foldMaps, parseMapRecord } from '../server/lib/maps';
import { relationsPrompt, RELATIONS_MARKER, CAPABILITIES_TREE_MARKER } from '../server/lib/prompt';
import { recordTemplate } from '../server/lib/scaffold';

/**
 * Ядро функциональной карты (docs/07-maps.md, «Приоритет и горизонт», «Связи
 * между возможностями», «Что дальше и что заденет»).
 */

const tree: CapabilityLike[] = [
  { id: 'shop', title: 'Магазин', priority: 'must', horizon: 'now' },
  { id: 'shop.pay', title: 'Оплата', parent: 'shop', status: 'not_implemented' },
  { id: 'shop.ship', title: 'Отправка', parent: 'shop', status: 'partial', priority: 'should' },
  { id: 'account', title: 'Аккаунт', status: 'implemented' },
  { id: 'reports', title: 'Отчёты', priority: 'could', horizon: 'later' },
  { id: 'reports.pdf', title: 'PDF', parent: 'reports', status: 'not_implemented' },
  { id: 'old', title: 'Старая оплата', status: 'implemented', priority: 'wont' },
  { id: 'wishes', title: 'Пожелания', status: 'not_implemented', priority: 'wont' }
];
const byId = new Map(tree.map((item) => [item.id, item]));

describe('приоритет и горизонт наследуются вниз', () => {
  it('своё значение главнее, нет своего — ближайший родитель', () => {
    expect(effectivePriority(byId.get('shop.ship') as CapabilityLike, byId)).toEqual({ value: 'should', inherited: false, from: 'shop.ship' });
    expect(effectivePriority(byId.get('shop.pay') as CapabilityLike, byId)).toEqual({ value: 'must', inherited: true, from: 'shop' });
    expect(effectiveHorizon(byId.get('shop.ship') as CapabilityLike, byId)).toEqual({ value: 'now', inherited: true, from: 'shop' });
  });

  it('нигде не задано — null, а не could и не later', () => {
    expect(effectivePriority(byId.get('account') as CapabilityLike, byId)).toBeNull();
    expect(effectiveHorizon(byId.get('account') as CapabilityLike, byId)).toBeNull();
  });

  it('незнакомое значение не считается заданным', () => {
    const odd: CapabilityLike[] = [{ id: 'a', priority: 'urgent' }];
    expect(effectivePriority(odd[0] as CapabilityLike, new Map(odd.map((item) => [item.id, item])))).toBeNull();
  });

  it('цикл в parent не вешает расчёт', () => {
    const loop: CapabilityLike[] = [{ id: 'a', parent: 'b' }, { id: 'b', parent: 'a' }];
    expect(effectivePriority(loop[0] as CapabilityLike, new Map(loop.map((item) => [item.id, item])))).toBeNull();
  });
});

describe('«опирается на» — одно правило для всех видов связи', () => {
  const relations: RelationLike[] = [
    { from: 'a', to: 'b', type: 'depends' },
    { from: 'a', to: 'c', type: 'uses' },
    { from: 'd', to: 'a', type: 'feeds' },
    { from: 'e', to: 'a', type: 'triggers' },
    { from: 'f', to: 'a', type: 'replaces' }
  ];

  it('depends и uses — от from к to, feeds и triggers — наоборот, replaces не входит', () => {
    expect(reliesOnEdges(relations)).toEqual([
      { a: 'a', b: 'b' },
      { a: 'a', b: 'c' },
      { a: 'a', b: 'd' },
      { a: 'a', b: 'e' }
    ]);
  });

  it('влияние идёт по цепочке до конца, в обе стороны', () => {
    const caps: CapabilityLike[] = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
    const chain: RelationLike[] = [
      { from: 'a', to: 'b', type: 'depends' },
      { from: 'b', to: 'c', type: 'uses' },
      { from: 'd', to: 'a', type: 'depends' }
    ];
    const impact = impactOf('b', chain, caps);
    expect(impact.reliesOn.sort()).toEqual(['c']);
    expect(impact.reliedOnBy.sort()).toEqual(['a', 'd']);
  });

  it('цикл не вешает влияние, а сама возможность в своих цепочках не появляется', () => {
    const caps: CapabilityLike[] = [{ id: 'a' }, { id: 'b' }];
    const impact = impactOf('a', [{ from: 'a', to: 'b', type: 'depends' }, { from: 'b', to: 'a', type: 'depends' }], caps);
    expect(impact.reliesOn).toEqual(['b']);
    expect(impact.reliedOnBy).toEqual(['b']);
  });

  it('связи с несуществующими концами во влияние не идут', () => {
    const impact = impactOf('a', [{ from: 'a', to: 'нет', type: 'depends' }], [{ id: 'a' }]);
    expect(impact).toEqual({ reliesOn: [], reliedOnBy: [] });
  });
});

describe('«заменяется»', () => {
  it('у заменяемой — кто её заменяет', () => {
    const map = replacedBy([
      { from: 'new', to: 'old', type: 'replaces' },
      { from: 'newer', to: 'old', type: 'replaces' },
      { from: 'x', to: 'y', type: 'depends' }
    ]);
    expect(map.get('old')).toEqual(['new', 'newer']);
    expect(map.has('y')).toBe(false);
  });
});

describe('«Освободит»', () => {
  it('считает не реализованных, что стоят за возможностью по цепочке depends', () => {
    const caps: CapabilityLike[] = [
      { id: 'base', status: 'not_implemented' },
      { id: 'mid', status: 'not_implemented' },
      { id: 'top', status: 'not_implemented' },
      { id: 'done', status: 'implemented' }
    ];
    const counts = unblockCounts(caps, [
      { from: 'mid', to: 'base', type: 'depends' },
      { from: 'top', to: 'mid', type: 'depends' },
      { from: 'done', to: 'base', type: 'depends' },
      { from: 'top', to: 'base', type: 'uses' }
    ]);
    expect(counts.get('base')).toBe(2);
    expect(counts.get('mid')).toBe(1);
    expect(counts.has('top')).toBe(false);
    expect(counts.has('done')).toBe(false);
  });
});

describe('«Можно начинать»', () => {
  it('нижние «Не реализовано» и «Частично», не ждущие и не «Не берём»; порядок — приоритет, горизонт, освободит', () => {
    const caps: CapabilityLike[] = [
      ...tree,
      { id: 'blocked', status: 'not_implemented', priority: 'must', horizon: 'now' },
      { id: 'free', status: 'not_implemented', priority: 'must', horizon: 'now' },
      { id: 'plain', status: 'not_implemented' },
      { id: 'raw' }
    ];
    const result = startNow(caps, [
      { from: 'blocked', to: 'plain', type: 'depends' },
      { from: 'blocked', to: 'free', type: 'uses' }
    ]);
    const ids = result.items.map((item) => item.id);
    expect(ids).toEqual(['free', 'shop.pay', 'shop.ship', 'reports.pdf', 'plain']);
    expect(ids).not.toContain('blocked');
    expect(ids).not.toContain('account');
    expect(ids).not.toContain('wishes');
    expect(ids).not.toContain('old');
  });

  it('не оценённые не берутся, но считаются отдельно; «Не берём» не считается нигде', () => {
    const result = startNow([
      { id: 'a' },
      { id: 'b', priority: 'wont' },
      { id: 'c', status: 'not_implemented' }
    ], []);
    expect(result.unrated).toBe(1);
    expect(result.items.map((item) => item.id)).toEqual(['c']);
  });

  it('приоритет и горизонт отдаются эффективные, с наследованием', () => {
    const result = startNow(tree, []);
    const pay = result.items.find((item) => item.id === 'shop.pay');
    expect(pay).toMatchObject({ priority: 'must', horizon: 'now' });
    expect(result.items.find((item) => item.id === 'shop.ship')).toMatchObject({ priority: 'should', horizon: 'now' });
  });

  it('родитель в список не попадает: берут нижние возможности', () => {
    expect(startNow(tree, []).items.map((item) => item.id)).not.toContain('shop');
  });
});

describe('отметки состояния не теряют приоритет и горизонт', () => {
  it('повторное объявление несёт их как были', () => {
    const { declarations } = statusDeclarations(tree, [{ id: 'shop.ship', status: 'implemented' }]);
    expect(declarations[0]).toMatchObject({ id: 'shop.ship', status: 'implemented', priority: 'should' });
  });
});

describe('пять видов связей', () => {
  it('triggers и replaces рисуются, незнакомый вид — нет', () => {
    const { drawn, skipped } = drawableRelations([
      { from: 'account', to: 'reports', type: 'triggers' },
      { from: 'account', to: 'old', type: 'replaces' },
      { from: 'account', to: 'old', type: 'blocks' }
    ], tree);
    expect(drawn).toHaveLength(2);
    expect(skipped).toBe(1);
  });

  it('схема принимает новые виды и поля', () => {
    const block = ['```docdd-functional', JSON.stringify({
      added: {
        capabilities: [{ id: 'a', priority: 'must', horizon: 'next' }],
        relations: [{ from: 'a', to: 'b', type: 'triggers' }, { from: 'a', to: 'c', type: 'replaces' }]
      }
    }), '```'].join('\n');
    const parsed = parseMapRecord(block);
    expect(parsed.problems).toEqual([]);

    const folded = foldMaps([{ id: 'M-0001', change: parsed.change }]);
    expect(folded.functional.capabilities[0]).toMatchObject({ priority: 'must', horizon: 'next' });
    expect(folded.functional.relations).toHaveLength(2);
  });

  it('схема отвергает незнакомые приоритет и горизонт', () => {
    const bad = (capability: object) => parseMapRecord(['```docdd-functional', JSON.stringify({ added: { capabilities: [capability] } }), '```'].join('\n')).problems;
    expect(bad({ id: 'a', priority: 'urgent' })).toHaveLength(1);
    expect(bad({ id: 'a', horizon: 'soon' })).toHaveLength(1);
  });
});

describe('пачка связей', () => {
  const caps: CapabilityLike[] = [
    { id: 'shop' },
    { id: 'shop.pay', parent: 'shop' },
    { id: 'account' },
    { id: 'reports' }
  ];
  const standing: RelationLike[] = [{ from: 'shop.pay', to: 'account', type: 'depends', summary: 'нужен вход' }];

  it('добавляет новое и убирает стоящее', () => {
    const plan = planRelations(
      caps,
      standing,
      [{ from: 'reports', to: 'account', type: 'uses' }],
      [{ from: 'shop.pay', to: 'account', type: 'depends' }]
    );
    expect(plan.problems).toEqual([]);
    expect(plan.add).toHaveLength(1);
    expect(plan.remove).toHaveLength(1);
    expect(plan.skipped).toEqual([]);
  });

  it('уже стоящая — пропуск, а не ошибка; новая фраза у той же связи — уточнение', () => {
    const same = planRelations(caps, standing, [{ from: 'shop.pay', to: 'account', type: 'depends', summary: 'нужен вход' }], []);
    expect(same.skipped).toEqual([{ from: 'shop.pay', to: 'account', type: 'depends', reason: 'уже есть' }]);
    expect(same.add).toEqual([]);

    const refined = planRelations(caps, standing, [{ from: 'shop.pay', to: 'account', type: 'depends', summary: 'нужен профиль' }], []);
    expect(refined.add).toHaveLength(1);
  });

  it('убрать то, чего нет, — пропуск', () => {
    const plan = planRelations(caps, standing, [], [{ from: 'reports', to: 'account', type: 'uses' }]);
    expect(plan.remove).toEqual([]);
    expect(plan.skipped[0]?.reason).toBe('такой связи нет');
  });

  it('хоть одна нерисуемая — проблема пачки: нет конца, сама с собой, предок с потомком', () => {
    const plan = planRelations(caps, [], [
      { from: 'reports', to: 'нет', type: 'uses' },
      { from: 'account', to: 'account', type: 'depends' },
      { from: 'shop.pay', to: 'shop', type: 'depends' },
      { from: 'reports', to: 'account', type: 'uses' }
    ], []);
    expect(plan.problems).toHaveLength(3);
    expect(plan.add).toHaveLength(1);
  });

  it('повторы в пачке схлопываются', () => {
    const plan = planRelations(caps, [], [
      { from: 'reports', to: 'account', type: 'uses' },
      { from: 'reports', to: 'account', type: 'uses' }
    ], []);
    expect(plan.add).toHaveLength(1);
  });

  it('связь другого вида между теми же двумя — другая связь', () => {
    const plan = planRelations(caps, standing, [{ from: 'shop.pay', to: 'account', type: 'feeds' }], []);
    expect(plan.add).toHaveLength(1);
    expect(plan.skipped).toEqual([]);
  });
});

describe('ответ «Предложить связи»', () => {
  const answer = (relations: unknown) => ['Вот что нашёл.', '```docdd-functional-relations', JSON.stringify({ relations }), '```'].join('\n');
  const caps: CapabilityLike[] = [{ id: 'shop' }, { id: 'shop.pay', parent: 'shop' }, { id: 'account' }, { id: 'reports' }];
  const standing: RelationLike[] = [{ from: 'shop.pay', to: 'account', type: 'depends' }];

  it('новые связи отдаются, остальное — в skipped с причиной', () => {
    const result = parseFunctionalRelations(answer([
      { from: 'reports', to: 'account', type: 'uses', summary: ' профиль ' },
      { from: 'shop.pay', to: 'account', type: 'depends' },
      { from: 'shop.pay', to: 'нет', type: 'depends' },
      { from: 'reports', to: 'account', type: 'blocks' },
      { from: 'account', to: 'account', type: 'uses' },
      { from: 'shop.pay', to: 'shop', type: 'uses' },
      { from: 'reports', to: 'account', type: 'uses' }
    ]), caps, standing);
    expect(result?.relations).toEqual([{ from: 'reports', to: 'account', type: 'uses', summary: 'профиль' }]);
    expect(result?.skipped.map((item) => item.reason)).toEqual([
      'уже есть',
      'нет такой возможности',
      'неизвестный вид',
      'связь с самой собой',
      'родитель и подпункт',
      'повторяется в ответе'
    ]);
  });

  it('блока нет или он не разбирается — null', () => {
    expect(parseFunctionalRelations('просто текст', caps, [])).toBeNull();
    expect(parseFunctionalRelations('```docdd-functional-relations\n{не json\n```', caps, [])).toBeNull();
    expect(parseFunctionalRelations('```docdd-functional-relations\n{"x":1}\n```', caps, [])).toBeNull();
  });

  it('строка без полей не роняет разбор', () => {
    const result = parseFunctionalRelations(answer([null, {}, 7]), caps, []);
    expect(result?.relations).toEqual([]);
    expect(result?.skipped).toHaveLength(3);
  });

  it('стоящие связи — списком для запроса', () => {
    expect(relationLines([])).toBe('Связей пока нет.');
    expect(relationLines([{ from: 'a', to: 'b', type: 'triggers', summary: 'оплата запускает отправку' }]))
      .toBe('- `a` —triggers→ `b` (оплата запускает отправку)');
  });
});

describe('запрос «Предложить связи»', () => {
  const template = ['# Шапка', 'для человека', '---', CAPABILITIES_TREE_MARKER, RELATIONS_MARKER].join('\n');

  it('подставляет дерево и стоящие связи, шапку для человека убирает', () => {
    const prompt = relationsPrompt(template, [{ id: 'a', title: 'А' }], [{ from: 'a', to: 'b', type: 'uses' }]);
    expect(prompt).toContain('`a` — А');
    expect(prompt).toContain('`a` —uses→ `b`');
    expect(prompt).not.toContain(RELATIONS_MARKER);
    expect(prompt).not.toContain('Шапка');
  });

  it('спецзнаки в тексте связи не ломают подстановку', () => {
    const prompt = relationsPrompt(template, [{ id: 'a' }], [{ from: 'a', to: 'b', type: 'uses', summary: 'цена $& за шт' }]);
    expect(prompt).toContain('цена $& за шт');
  });
});

describe('разбор входящего несёт связи и состояния', () => {
  const proposed: CapabilityLike[] = [{ id: 'priyom' }, { id: 'zapis', parent: 'priyom' }, { id: 'vyzov' }];
  const standing: CapabilityLike[] = [{ id: 'account' }];

  it('концы — из предложения или из карты; остальное названо', () => {
    const result = usableRelations([
      { from: 'vyzov', to: 'account', type: 'depends' },
      { from: 'vyzov', to: 'priyom', type: 'triggers', summary: 'вызов открывает приём' },
      { from: 'vyzov', to: 'нет', type: 'uses' },
      { from: 'zapis', to: 'priyom', type: 'depends' }
    ], proposed, standing);
    expect(result.relations.map((item) => `${item.from}>${item.to}`)).toEqual(['vyzov>account', 'vyzov>priyom']);
    expect(result.problems).toHaveLength(2);
    expect(result.problems[0]).toContain('нет ни в предложении, ни в карте');
  });

  it('связей нет — нечего пропускать', () => {
    expect(usableRelations(undefined, proposed, standing)).toEqual({ relations: [], problems: [] });
  });

  it('карта заводится с состоянием, приоритетом и связями в одном блоке', () => {
    const text = recordTemplate({
      id: 'M-0001',
      type: 'map',
      title: 'Приём',
      today: '2026-10-02',
      capabilities: [{ id: 'zapis', title: 'Запись', status: 'partial', note: 'нет онлайн-записи', priority: 'must', horizon: 'now' }],
      relations: [{ from: 'zapis', to: 'account', type: 'depends', summary: 'нужен вход' }]
    });
    const block = /```docdd-functional\n([\s\S]*?)```/.exec(text)?.[1] ?? '';
    const parsed = JSON.parse(block);
    expect(parsed.added.capabilities[0]).toMatchObject({ status: 'partial', priority: 'must', horizon: 'now' });
    expect(parsed.added.relations).toHaveLength(1);
    expect(parseMapRecord(text).problems).toEqual([]);
  });

  it('карта с одними связями — тоже карта', () => {
    const text = recordTemplate({
      id: 'M-0002', type: 'map', title: 'Связи', today: '2026-10-02',
      relations: [{ from: 'a', to: 'b', type: 'feeds' }]
    });
    expect(text).toContain('```docdd-functional');
    expect(text).not.toContain('Зачем это, что делаем');
  });
});

describe('фильтры оставляют листья и их предков', () => {
  it('по приоритету и горизонту — эффективным, с наследованием', () => {
    const must = filterLeaves(tree, planPredicate(tree, { priority: 'must' }));
    expect(must.map((item) => item.id)).toEqual(['shop', 'shop.pay']);

    const later = filterLeaves(tree, planPredicate(tree, { horizon: 'later' }));
    expect(later.map((item) => item.id)).toEqual(['reports', 'reports.pdf']);

    const none = filterLeaves(tree, planPredicate(tree, { priority: 'none' }));
    expect(none.map((item) => item.id)).toEqual(['account']);
  });

  it('фильтра нет — всё как есть', () => {
    expect(planPredicate(tree, {})).toBeNull();
    expect(filterLeaves(tree, null)).toHaveLength(tree.length);
  });

  it('два условия — оба', () => {
    const both = filterLeaves(tree, planPredicate(tree, { priority: 'should', horizon: 'now' }));
    expect(both.map((item) => item.id)).toEqual(['shop', 'shop.ship']);
  });
});

describe('несохранённые связи поверх картины', () => {
  const standing: RelationLike[] = [
    { from: 'a', to: 'b', type: 'depends', summary: 'старая фраза' },
    { from: 'a', to: 'c', type: 'uses' }
  ];

  it('добавленные видны сразу и помечены, убранные уходят', () => {
    const effective = withRelationMarks(standing, {
      add: [{ from: 'b', to: 'c', type: 'feeds' }],
      remove: [{ from: 'a', to: 'c', type: 'uses' }]
    });
    expect(effective.map((item) => `${item.from}>${item.to}:${item.type}`)).toEqual(['a>b:depends', 'b>c:feeds']);
    expect(effective[1]).toMatchObject({ unsaved: true });
    expect(effective[0]).not.toHaveProperty('unsaved');
  });

  it('та же связь с новой фразой — уточнение, а не дубль', () => {
    const effective = withRelationMarks(standing, { add: [{ from: 'a', to: 'b', type: 'depends', summary: 'новая' }], remove: [] });
    expect(effective.filter((item) => item.from === 'a' && item.to === 'b')).toHaveLength(1);
    expect(effective.find((item) => item.to === 'b')?.summary).toBe('новая');
  });

  it('пустая пачка ничего не меняет; счёт — добавленные и убранные', () => {
    expect(withRelationMarks(standing, NO_RELATION_MARKS)).toEqual(standing);
    expect(relationMarkCount({ add: [{ from: 'a', to: 'b', type: 'uses' }], remove: [{ from: 'x', to: 'y', type: 'uses' }] })).toBe(2);
  });
});

describe('уровни графа', () => {
  const caps: CapabilityLike[] = [
    { id: 'shop', title: 'Магазин' },
    { id: 'shop.pay', title: 'Оплата', parent: 'shop', status: 'implemented' },
    { id: 'shop.ship', title: 'Отправка', parent: 'shop', status: 'not_implemented' },
    { id: 'shop.ship.track', title: 'Трекинг', parent: 'shop.ship', status: 'not_implemented' },
    { id: 'account', title: 'Аккаунт', status: 'not_implemented' },
    { id: 'reports', title: 'Отчёты', status: 'not_implemented' }
  ];
  const rels: RelationLike[] = [
    { from: 'shop.pay', to: 'account', type: 'depends' },
    { from: 'shop.ship', to: 'account', type: 'depends' },
    { from: 'account', to: 'shop.ship.track', type: 'depends' },
    { from: 'reports', to: 'shop.pay', type: 'uses' },
    { from: 'shop.pay', to: 'shop.ship', type: 'feeds' }
  ];

  it('группа — верхний предок', () => {
    expect(rootOf('shop.ship.track', caps)).toBe('shop');
    expect(rootOf('account', caps)).toBe('account');
    expect(rootOf('нет', caps)).toBe('нет');
  });

  it('цикл в parent не вешает поиск группы', () => {
    const loop: CapabilityLike[] = [{ id: 'a', parent: 'b' }, { id: 'b', parent: 'a' }];
    expect(['a', 'b']).toContain(rootOf('a', loop));
  });

  it('обзор: группы со счётом, связи свёрнуты по виду, внутри группы — не считаются', () => {
    const level = groupLevel(caps, rels);
    expect(level.groups.map((group) => group.id)).toEqual(['shop', 'account', 'reports']);
    expect(level.groups[0]?.progress).toMatchObject({ implemented: 1, not_implemented: 1, total: 2 });
    expect(level.groups[0]?.status).toBe('partial');

    const dependsShopAccount = level.edges.find((edge) => edge.from === 'shop' && edge.to === 'account' && edge.type === 'depends');
    expect(dependsShopAccount?.count).toBe(2);
    expect(level.edges.some((edge) => edge.from === 'shop' && edge.to === 'shop')).toBe(false);
    expect(level.edges.find((edge) => edge.from === 'reports')?.type).toBe('uses');
  });

  it('обзор: группы, что ждут друг друга по depends, помечены циклом', () => {
    const level = groupLevel(caps, rels);
    expect([...level.cycle].sort()).toEqual(['account', 'shop']);
  });

  it('группа: её возможности и связи с обоими концами внутри', () => {
    const scope = groupScopeOf(caps, rels, 'shop');
    expect(scope.capabilities.map((item) => item.id)).toEqual(['shop', 'shop.pay', 'shop.ship', 'shop.ship.track']);
    expect(scope.relations).toEqual([{ from: 'shop.pay', to: 'shop.ship', type: 'feeds' }]);
  });

  it('призраки выбранной возможности — соседи из других групп, со связями', () => {
    const ghosts = functionalGhosts(caps, rels, 'shop', 'shop.pay');
    expect(ghosts.map((ghost) => ghost.id).sort()).toEqual(['account', 'reports']);
    const account = ghosts.find((ghost) => ghost.id === 'account');
    expect(account).toMatchObject({ groupId: 'account', groupTitle: 'Аккаунт' });
    expect(account?.links).toEqual([{ direction: 'out', type: 'depends', summary: undefined }]);
    expect(ghosts.find((ghost) => ghost.id === 'reports')?.links[0]).toMatchObject({ direction: 'in', type: 'uses' });
  });

  it('выбранная не из этой группы — призраков нет', () => {
    expect(functionalGhosts(caps, rels, 'shop', 'account')).toEqual([]);
  });
});

describe('признаки расхождения — одно правило для предупреждений и экрана', () => {
  const cover = (done: number, total: number, failed = 0) => ({
    tasks: { total, done, active: 0, ids: [], statuses: {} },
    verifications: { passed: 0, failed, unknown: 0, ids: [], results: {} }
  });

  it('ahead, behind, failing', () => {
    expect(consistencyFlags('implemented', cover(0, 2))).toEqual(['ahead']);
    expect(consistencyFlags(null, cover(2, 2))).toEqual(['behind']);
    expect(consistencyFlags('not_implemented', cover(1, 1))).toEqual(['behind']);
    expect(consistencyFlags('partial', cover(1, 1, 1))).toEqual(['failing']);
    expect(consistencyFlags('implemented', cover(0, 1, 1))).toEqual(['ahead', 'failing']);
  });

  it('следа нет или всё сходится — признаков нет', () => {
    expect(consistencyFlags('implemented', undefined)).toEqual([]);
    expect(consistencyFlags('implemented', cover(0, 0))).toEqual([]);
    expect(consistencyFlags('implemented', cover(1, 2))).toEqual([]);
    expect(consistencyFlags('partial', cover(2, 2))).toEqual([]);
  });
});

describe('очередь связей на экране', () => {
  const saved: RelationLike[] = [{ from: 'a', to: 'b', type: 'depends', summary: 'нужен вход' }];

  it('новая — в add; такая же, какая уже стоит, — ничего', () => {
    const added = queueRelationAdd(NO_RELATION_MARKS, { from: 'a', to: 'c', type: 'uses' }, saved);
    expect(added.add).toHaveLength(1);
    expect(queueRelationAdd(NO_RELATION_MARKS, { from: 'a', to: 'b', type: 'depends', summary: 'нужен вход' }, saved)).toEqual(NO_RELATION_MARKS);
  });

  it('новая фраза у стоящей — уточнение, в add; повтор той же в очереди не двоится', () => {
    const refined = queueRelationAdd(NO_RELATION_MARKS, { from: 'a', to: 'b', type: 'depends', summary: 'нужен профиль' }, saved);
    expect(refined.add).toHaveLength(1);
    const again = queueRelationAdd(refined, { from: 'a', to: 'b', type: 'depends', summary: 'ещё раз' }, saved);
    expect(again.add).toHaveLength(1);
    expect(again.add[0]?.summary).toBe('ещё раз');
  });

  it('вернули связь, которую собирались убрать, — убирание отменено', () => {
    const removed = queueRelationRemove(NO_RELATION_MARKS, { from: 'a', to: 'b', type: 'depends' }, saved);
    expect(removed.remove).toHaveLength(1);
    const back = queueRelationAdd(removed, { from: 'a', to: 'b', type: 'depends', summary: 'нужен вход' }, saved);
    expect(back).toEqual(NO_RELATION_MARKS);
  });

  it('убрать несохранённую — выходит из пачки, убрать стоящую — уходит в remove один раз', () => {
    const queued = queueRelationAdd(NO_RELATION_MARKS, { from: 'a', to: 'c', type: 'uses' }, saved);
    expect(queueRelationRemove(queued, { from: 'a', to: 'c', type: 'uses' }, saved)).toEqual(NO_RELATION_MARKS);

    const once = queueRelationRemove(NO_RELATION_MARKS, { from: 'a', to: 'b', type: 'depends' }, saved);
    expect(queueRelationRemove(once, { from: 'a', to: 'b', type: 'depends' }, saved).remove).toHaveLength(1);
  });

  it('убрать уточнённую стоящую: уточнение уходит, а стоящая — в remove', () => {
    const refined = queueRelationAdd(NO_RELATION_MARKS, { from: 'a', to: 'b', type: 'depends', summary: 'нужен профиль' }, saved);
    const gone = queueRelationRemove(refined, { from: 'a', to: 'b', type: 'depends' }, saved);
    expect(gone.add).toEqual([]);
    expect(gone.remove).toHaveLength(1);
  });

  it('убрать то, чего нигде нет, — ничего', () => {
    expect(queueRelationRemove(NO_RELATION_MARKS, { from: 'x', to: 'y', type: 'uses' }, saved)).toEqual(NO_RELATION_MARKS);
  });
});
