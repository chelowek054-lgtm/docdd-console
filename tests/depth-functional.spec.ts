import { describe, expect, it } from 'vitest';

import { groupLevel, openGroupOverview, overviewAt, rootOf, type CapabilityLike, type RelationLike } from '../server/lib/functional';

/** R-0040 / ADR-0027: обзор функциональной карты на любой глубине. */
const caps: CapabilityLike[] = [
  { id: 'shop', title: 'Магазин' },
  { id: 'shop.cart', parent: 'shop' },
  { id: 'shop.cart.add', parent: 'shop.cart' },
  { id: 'shop.cart.drop', parent: 'shop.cart' },
  { id: 'shop.pay', parent: 'shop' },
  { id: 'account' },
  { id: 'account.login', parent: 'account' },
  { id: 'docs' }
];
const rels: RelationLike[] = [
  { from: 'shop.cart.add', to: 'account.login', type: 'depends' },
  { from: 'shop.cart.drop', to: 'account.login', type: 'depends' },
  { from: 'shop.pay', to: 'shop.cart.add', type: 'uses' },
  { from: 'shop.cart.add', to: 'shop.cart.drop', type: 'uses' },
  { from: 'account.login', to: 'shop.pay', type: 'depends' }
];

describe('обзор на любой глубине', () => {
  it('на уровне 0 без раскрытой группы совпадает с groupLevel', () => {
    const old = groupLevel(caps, rels);
    const now = overviewAt(caps, rels, null, 0);
    expect(now.nodes.map((n) => n.id).sort()).toEqual(old.groups.map((g) => g.id).sort());
    const flat = (e: { from: string; to: string; type: string; count: number; waiting: boolean }) =>
      `${e.from}>${e.to}:${e.type}:${e.count}:${e.waiting}`;
    expect(now.edges.map(flat).sort()).toEqual(old.edges.map(flat).sort());
    expect([...now.cycle].sort()).toEqual([...old.cycle].sort());
    for (const g of old.groups) {
      const n = now.nodes.find((x) => x.id === g.id)!;
      expect(n.title).toBe(g.title);
      expect(n.progress).toEqual(g.progress);
      expect(n.status).toBe(g.status);
    }
  });

  it('уровень 1 раскрывает корни на один шаг, стрелки идут между видимыми предками', () => {
    const o = overviewAt(caps, rels, null, 1);
    expect(o.nodes.map((n) => n.id).sort()).toEqual(['account.login', 'docs', 'shop.cart', 'shop.pay']);
    const cartToLogin = o.edges.find((e) => e.from === 'shop.cart' && e.to === 'account.login' && e.type === 'depends')!;
    expect(cartToLogin.count).toBe(2);
    expect(cartToLogin.members).toHaveLength(2);
    // связь add→drop лежит внутри shop.cart и стрелкой не рисуется
    expect(o.internal).toBe(1);
  });

  it('любая стрелка раскрывается до исходных связей: сумма members равна числу связей', () => {
    for (const level of [0, 1, 2, 5]) {
      const o = overviewAt(caps, rels, null, level);
      const total = o.edges.reduce((sum, e) => sum + e.members.length, 0) + o.internal;
      expect(total).toBe(rels.length);
      for (const e of o.edges) expect(e.count).toBe(e.members.length);
    }
  });

  it('глубже самой глубокой ветки показывает листья', () => {
    const o = overviewAt(caps, rels, null, 99);
    expect(o.nodes).toHaveLength(caps.length - 3); // shop, shop.cart, account — группы без своих связей
    expect(o.nodes.every((n) => n.size === 1)).toBe(true);
  });

  it('раскрытая на месте группа: дети внутри, соседи свёрнуты до её уровня', () => {
    const o = openGroupOverview(caps, rels, 'shop');
    expect(o.nodes.map((n) => n.id).sort()).toEqual(['account', 'docs', 'shop.cart', 'shop.pay']);
    const out = o.edges.find((e) => e.from === 'shop.cart' && e.to === 'account');
    expect(out?.count).toBe(2);
  });

  it('вид связи различается: depends и uses между теми же узлами — две стрелки', () => {
    const o = overviewAt(
      [{ id: 'a' }, { id: 'b' }],
      [{ from: 'a', to: 'b', type: 'depends' }, { from: 'a', to: 'b', type: 'uses' }],
      null, 0
    );
    expect(o.edges.map((e) => e.type).sort()).toEqual(['depends', 'uses']);
  });

  it('цикл depends между видимыми узлами находится на каждом уровне', () => {
    const o = overviewAt(caps, rels, null, 0);
    expect(o.cycle.has('shop')).toBe(true);
    expect(o.cycle.has('account')).toBe(true);
    expect(o.cycle.has('docs')).toBe(false);
  });

  it('пустые данные и неизвестная открытая группа не роняют расчёт', () => {
    const empty = overviewAt([], [], null, 0);
    expect(empty).toMatchObject({ nodes: [], edges: [], internal: 0 });
    expect(() => overviewAt(caps, rels, 'нет-такой', 1)).not.toThrow();
  });

  it('родитель-призрак делает узел корнем, цикл parent не роняет расчёт и rootOf', () => {
    const ghost = [{ id: 'x', parent: 'нет' }, { id: 'y', parent: 'x' }];
    expect(rootOf('y', ghost)).toBe('x');
    expect(overviewAt(ghost, [], null, 0).nodes.map((n) => n.id)).toEqual(['x']);
    const loop = [{ id: 'a', parent: 'b' }, { id: 'b', parent: 'a' }];
    expect(() => overviewAt(loop, [], null, 0)).not.toThrow();
    expect(['a', 'b']).toContain(rootOf('a', loop));
  });

  it('связь с неизвестным концом не попадает в обзор', () => {
    const o = overviewAt(caps, [{ from: 'shop.pay', to: 'нет', type: 'depends' }], null, 1);
    expect(o.edges).toHaveLength(0);
  });
});
