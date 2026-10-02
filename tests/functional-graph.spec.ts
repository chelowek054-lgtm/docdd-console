import { describe, expect, it } from 'vitest';

import { capabilityViews, planText, riskLevel, tasksText } from '../app/utils/functional-view';
import { functionalMermaid, type FunctionalGraphOptions } from '../app/utils/map-mermaid';
import type { CapabilityCoverage } from '../server/lib/functional';
import { emptyProjectMap, type ProjectMap } from '../server/lib/maps';

/**
 * Граф состояния: уровни, режимы окраски, фильтры, призраки и влияние
 * (docs/04-ui.md, «Уровни графа», «Режимы окраски», «Что дальше и влияние»).
 */

type Caps = ProjectMap['functional']['capabilities'];
type Rels = ProjectMap['functional']['relations'];

function graph(capabilities: Caps, relations: Rels = [], filter: Parameters<typeof functionalMermaid>[1] = null, options: FunctionalGraphOptions = {}) {
  const map = emptyProjectMap();
  map.functional = { capabilities, relations, vision: null };
  return functionalMermaid(map, filter, options);
}

const cover = (partial: Partial<CapabilityCoverage> = {}): CapabilityCoverage => ({
  maps: ['M-0001'],
  requirements: { total: 0, approved: 0, ids: [], statuses: {} },
  tasks: { total: 0, done: 0, active: 0, ids: [], statuses: {} },
  verifications: { passed: 0, failed: 0, unknown: 0, ids: [], results: {} },
  code: [],
  level: 'none',
  ...partial
});

const shop: Caps = [
  { id: 'shop', title: 'Магазин', priority: 'must', horizon: 'now' },
  { id: 'shop.pay', title: 'Оплата', parent: 'shop', status: 'implemented' },
  { id: 'shop.ship', title: 'Отправка', parent: 'shop', status: 'not_implemented' },
  { id: 'account', title: 'Аккаунт', status: 'not_implemented' },
  { id: 'reports', title: 'Отчёты', status: 'partial', priority: 'could' }
];

describe('пять видов связей на графе', () => {
  const caps: Caps = [{ id: 'a', title: 'А' }, { id: 'b', title: 'Б' }, { id: 'c', title: 'В' }];

  it('triggers — с кружком, replaces — с крестом, обе окрашены', () => {
    const { text } = graph(caps, [
      { from: 'a', to: 'b', type: 'triggers', summary: 'оплата запускает отправку' },
      { from: 'a', to: 'c', type: 'replaces' }
    ]);
    expect(text).toContain('f_a --o|"оплата запускает отправку"| f_b');
    expect(text).toContain('f_a --x f_c');
    expect(text).toContain('linkStyle 0 stroke:#7C3AED');
    expect(text).toContain('linkStyle 1 stroke:#6B7280');
  });

  it('легенда называет новые виды с числом', () => {
    const { text } = graph(caps, [
      { from: 'a', to: 'b', type: 'triggers' },
      { from: 'a', to: 'c', type: 'triggers' },
      { from: 'b', to: 'c', type: 'replaces' }
    ]);
    expect(text).toContain('--o|"запускает · 2"|');
    expect(text).toContain('--x|"заменяет · 1"|');
    expect(text).not.toContain('зависит от');
  });

  it('скрытый вид уходит со схемы и из легенды', () => {
    const { text } = graph(caps, [
      { from: 'a', to: 'b', type: 'depends' },
      { from: 'a', to: 'c', type: 'uses' }
    ], null, { hiddenKinds: new Set(['uses']) });
    expect(text).toContain('f_a --> f_b');
    expect(text).not.toContain('-.->');
    expect(text).not.toContain('пользуется');
  });
});

describe('режимы окраски', () => {
  const caps: Caps = [
    { id: 'a', title: 'А', status: 'implemented' },
    { id: 'b', title: 'Б', status: 'not_implemented' },
    { id: 'c', title: 'В', status: 'partial' },
    { id: 'd', title: 'Г' }
  ];
  const coverage = {
    a: cover({ level: 'verified', requirements: { total: 1, approved: 1, ids: ['R-1'], statuses: {} }, tasks: { total: 2, done: 2, active: 0, ids: ['T-1', 'T-2'], statuses: {} }, verifications: { passed: 1, failed: 0, unknown: 0, ids: ['V-1'], results: {} } }),
    b: cover({ level: 'failing', tasks: { total: 1, done: 1, active: 0, ids: ['T-3'], statuses: {} }, verifications: { passed: 0, failed: 1, unknown: 0, ids: ['V-2'], results: {} } }),
    c: cover({ level: 'no_check', tasks: { total: 1, done: 0, active: 1, ids: ['T-4'], statuses: {} } })
  };

  it('состояние: «задачи 3/5» дописываются, когда за возможностью есть задачи', () => {
    const { text } = graph(caps, [], null, { coverage });
    expect(text).toContain('f_a["А<br/>Реализовано · задачи 2/2"]:::st_implemented');
    expect(text).toContain('f_d["Г<br/>Не оценено"]:::st_unrated');
  });

  it('покрытие: цвет — уровень, под ним счёт требований, задач и проверок', () => {
    const { text } = graph(caps, [], null, { mode: 'coverage', coverage });
    expect(text).toContain('f_a["А<br/>Подтверждено фактом<br/>треб. 1 · задачи 2/2 · проверки 1/1"]:::cv_verified');
    expect(text).toContain('f_b["Б<br/>Проверка падает<br/>задачи 1/1 · проверки 0/1"]:::cv_failing');
    expect(text).toContain('f_c["В<br/>Без проверки<br/>задачи 0/1"]:::cv_no_check');
    expect(text).toContain('f_d["Г<br/>Нет следа"]:::cv_none');
    expect(text).toContain('legend_s_verified["Подтверждено фактом · 1"]:::cv_verified');
    expect(text).not.toContain('legend_s_unchecked');
  });

  it('риски: худший признак красит, слова называют все; без признаков — серый с состоянием', () => {
    const { text } = graph(caps, [], null, { mode: 'risks', coverage });
    // b: «Не реализовано», все задачи закрыты и проверка падает — «задачи закрыты, отметки нет»
    expect(text).toContain('f_b["Б<br/>задачи закрыты, отметки нет"]:::rk_orange');
    expect(text).toContain('f_d["Г<br/>Не оценено"]:::rk_none');
    expect(text).toContain('legend_s_orange["Отметка расходится с задачами · 1"]:::rk_orange');
  });

  it('риски: цикл и ждёт', () => {
    const { text } = graph(
      [{ id: 'a', title: 'А', status: 'partial' }, { id: 'b', title: 'Б', status: 'not_implemented' }, { id: 'c', title: 'В', status: 'partial' }, { id: 'd', title: 'Г', status: 'not_implemented' }],
      [
        { from: 'a', to: 'b', type: 'depends' }, { from: 'b', to: 'a', type: 'depends' },
        { from: 'c', to: 'd', type: 'depends' }
      ],
      null,
      { mode: 'risks' }
    );
    expect(text).toContain('f_a["А<br/>цикл · ждёт: Б"]:::rk_red');
    expect(text).toContain('f_c["В<br/>ждёт: Г"]:::rk_yellow');
  });

  it('порядок: «можно начинать» с «освободит», «ждёт», «готово», «не берём»; раскладка слева направо наоборот', () => {
    const { text } = graph(
      [
        { id: 'base', title: 'Основа', status: 'not_implemented', priority: 'must', horizon: 'now' },
        { id: 'top', title: 'Верх', status: 'not_implemented' },
        { id: 'done', title: 'Готово', status: 'implemented' },
        { id: 'later', title: 'Позже', status: 'not_implemented', priority: 'wont' },
        { id: 'raw', title: 'Сырое' }
      ],
      [{ from: 'top', to: 'base', type: 'depends' }],
      null,
      { mode: 'order' }
    );
    expect(text).toContain('flowchart RL');
    expect(text).toContain('f_base["Основа<br/>Можно начинать · освободит 1<br/>Обязательно · Сейчас"]:::or_start');
    expect(text).toContain('f_top["Верх<br/>Ждёт: Основа"]:::or_wait');
    expect(text).toContain('f_done["Готово<br/>Готово"]:::or_done');
    expect(text).toContain('f_later["Позже<br/>Не берём"]:::or_skip');
    expect(text).toContain('f_raw["Сырое<br/>Не оценено"]:::or_unrated');
  });

  it('заменяемая возможность помечена в любом режиме', () => {
    const { text } = graph(
      [{ id: 'old', title: 'Старая', status: 'implemented' }, { id: 'new', title: 'Новая', status: 'not_implemented' }],
      [{ from: 'new', to: 'old', type: 'replaces' }]
    );
    expect(text).toContain('f_old["Старая<br/>Реализовано<br/>заменяется на Новая"]');
  });
});

describe('фильтры', () => {
  it('приоритет и горизонт — эффективные, с наследованием', () => {
    const { text } = graph(shop, [], null, { plan: { priority: 'must' } });
    expect(text).toContain('f_shop_pay[');
    expect(text).toContain('f_shop_ship[');
    expect(text).not.toContain('f_account[');
    expect(text).not.toContain('f_reports[');
  });

  it('«только риски» оставляет листья с признаком и их родителей', () => {
    const caps: Caps = [
      { id: 'g', title: 'Группа' },
      { id: 'g.a', title: 'А', parent: 'g', status: 'partial' },
      { id: 'g.b', title: 'Б', parent: 'g', status: 'not_implemented' },
      { id: 'other', title: 'Прочее', status: 'implemented' }
    ];
    const { text } = graph(caps, [{ from: 'g.a', to: 'g.b', type: 'depends' }], null, { onlyRisks: true });
    expect(text).toContain('f_g_a[');
    expect(text).not.toContain('f_g_b[');
    expect(text).not.toContain('f_other[');
    expect(text).toContain('subgraph f_g');
  });

  it('под фильтр ничего не подошло — пустая схема', () => {
    expect(graph(shop, [], null, { plan: { horizon: 'later' } }).text).toBe('');
  });
});

describe('уровни: обзор групп', () => {
  const caps: Caps = [
    { id: 'shop', title: 'Магазин' },
    { id: 'shop.pay', title: 'Оплата', parent: 'shop', status: 'implemented' },
    { id: 'shop.ship', title: 'Отправка', parent: 'shop', status: 'not_implemented' },
    { id: 'account', title: 'Аккаунт', status: 'not_implemented' },
    { id: 'reports', title: 'Отчёты', status: 'partial' }
  ];
  const rels: Rels = [
    { from: 'shop.pay', to: 'account', type: 'depends' },
    { from: 'shop.ship', to: 'account', type: 'depends' },
    { from: 'reports', to: 'shop.pay', type: 'triggers' }
  ];

  it('узел — группа со счётом, стрелка — свёрнутые связи с числом', () => {
    const { text, nodes, neighbors } = graph(caps, rels, null, { level: 'groups' });
    expect(text).toContain('fgrp_shop["Магазин<br/>1 из 2<br/>Частично"]:::st_partial');
    expect(text).toContain('fgrp_account["Аккаунт<br/>0 из 1<br/>Не реализовано"]:::st_not_implemented');
    expect(text).toContain('fgrp_shop -->|"2 связей"| fgrp_account');
    expect(text).toContain('fgrp_reports --o|"1 связь"| fgrp_shop');
    expect(text).not.toContain('f_shop_pay');
    expect(nodes['fgrp_shop']?.capabilityGroup).toBe('shop');
    expect(nodes['fgrp_shop']?.capabilityView?.progress?.total).toBe(2);
    expect(neighbors['fgrp_shop']?.sort()).toEqual(['fgrp_account', 'fgrp_reports']);
  });

  it('группы, ждущие друг друга, краснеют', () => {
    const { text } = graph(caps, [...rels, { from: 'account', to: 'shop.ship', type: 'depends' }], null, { level: 'groups' });
    expect(text).toContain('linkStyle 0 stroke:#DC2626');
    expect(text).toContain('красная — ждут друг друга');
  });

  it('фильтр оставляет группы с подходящими возможностями', () => {
    const { text } = graph(caps, rels, 'partial', { level: 'groups' });
    expect(text).toContain('fgrp_reports[');
    expect(text).not.toContain('fgrp_account[');
  });

  it('легенда — только то, что нарисовано', () => {
    const { text } = graph(caps, rels, null, { level: 'groups' });
    expect(text).toContain('legend_s_partial["Частично · 2"]:::st_partial');
    expect(text).toContain('зависит от · 1');
    expect(text).toContain('запускает · 1');
    expect(text).not.toContain('пользуется');
  });
});

describe('уровни: группа и призраки', () => {
  const caps: Caps = [
    { id: 'shop', title: 'Магазин' },
    { id: 'shop.pay', title: 'Оплата', parent: 'shop', status: 'implemented' },
    { id: 'shop.ship', title: 'Отправка', parent: 'shop', status: 'not_implemented' },
    { id: 'account', title: 'Аккаунт', status: 'not_implemented' },
    { id: 'reports', title: 'Отчёты', status: 'partial' }
  ];
  const rels: Rels = [
    { from: 'shop.pay', to: 'shop.ship', type: 'feeds' },
    { from: 'shop.pay', to: 'account', type: 'depends' },
    { from: 'reports', to: 'shop.pay', type: 'uses' }
  ];

  it('рисует только возможности группы и связи между ними', () => {
    const { text } = graph(caps, rels, null, { level: 'group', group: 'shop' });
    expect(text).toContain('subgraph f_shop');
    expect(text).toContain('f_shop_pay[');
    expect(text).not.toContain('f_account[');
    expect(text).toContain('f_shop_pay ==> f_shop_ship');
    expect(text).not.toContain('Из других групп');
  });

  it('выбранная возможность показывает соседей из других групп призраками со связями', () => {
    const { text, nodes } = graph(caps, rels, null, { level: 'group', group: 'shop', selected: 'shop.pay' });
    expect(text).toContain('subgraph ghosts["Из других групп"]');
    expect(text).toContain('f_account["Аккаунт<br/>из группы Аккаунт"]:::ghost');
    expect(text).toContain('f_shop_pay --> f_account');
    expect(text).toContain('f_reports -.-> f_shop_pay');
    expect(nodes['f_account']?.ghost).toEqual({ groupId: 'account', groupTitle: 'Аккаунт' });
    expect(nodes['f_account']?.capabilityGroup).toBe('account');
  });

  it('призраки — не часть группы: выбранный из другой группы или без соседей их не даёт', () => {
    expect(graph(caps, rels, null, { level: 'group', group: 'shop', selected: 'shop.ship' }).text).not.toContain('ghosts');
  });

  it('больше двенадцати соседей сворачиваются в узлы-группы по одной стрелке на группу и вид', () => {
    const many: Caps = [{ id: 'g', title: 'Г' }, { id: 'g.x', title: 'Х', parent: 'g' }, { id: 'g.y', title: 'У', parent: 'g' }];
    const relations: Rels = [];
    for (let at = 0; at < 14; at += 1) {
      many.push({ id: `ext${at}`, title: `Внешняя ${at}` });
      relations.push({ from: 'g.x', to: `ext${at}`, type: 'uses' });
    }
    const { text } = graph(many, relations, null, { level: 'group', group: 'g', selected: 'g.x' });
    // Каждая внешняя возможность — своя группа верхнего уровня, поэтому сворачиваются по группам, а узлов столько же.
    expect(text.match(/fgg_ext\d+\[/g)?.length).toBe(14);
  });

  it('скрытый вид убирает и призраков, что держались только на нём', () => {
    const { text } = graph(caps, rels, null, { level: 'group', group: 'shop', selected: 'shop.pay', hiddenKinds: new Set(['depends', 'uses']) });
    expect(text).not.toContain('ghosts');
  });
});

describe('влияние', () => {
  const caps: Caps = [
    { id: 'a', title: 'А' }, { id: 'b', title: 'Б' }, { id: 'c', title: 'В' }, { id: 'd', title: 'Г' }, { id: 'z', title: 'Не связана' }
  ];
  const rels: Rels = [
    { from: 'b', to: 'a', type: 'depends' },
    { from: 'c', to: 'b', type: 'depends' },
    { from: 'b', to: 'd', type: 'uses' }
  ];

  it('выбранная, цепочка «опирается на», цепочка «на неё опираются»; остальное приглушено', () => {
    const { text } = graph(caps, rels, null, { selected: 'b', impact: true });
    expect(text).toContain('class f_b imp_self;');
    expect(text).toContain('class f_a,f_d imp_up;');
    expect(text).toContain('class f_c imp_down;');
    expect(text).toContain('class f_z imp_dim;');
    expect(text).toContain('На чём стоит · 2');
    expect(text).toContain('Что заденет · 1');
  });

  it('связи вне цепочки приглушены, внутри — нет', () => {
    const { text } = graph(caps, [...rels, { from: 'z', to: 'a', type: 'uses' }], null, { selected: 'b', impact: true });
    // Четвёртая связь (№3) уходит из «не связанной» — вне цепочки.
    expect(text).toMatch(/linkStyle 3 stroke-opacity:0\.2;/);
    expect(text).not.toMatch(/linkStyle 0 stroke-opacity/);
  });

  it('без выбора или без включения ничего не меняется', () => {
    expect(graph(caps, rels, null, { impact: true }).text).not.toContain('imp_');
    expect(graph(caps, rels, null, { selected: 'b' }).text).not.toContain('imp_');
  });
});

describe('представление возможности для экрана', () => {
  it('приоритет, горизонт, «освободит», влияние, «заменяется» и признаки риска', () => {
    const caps: Caps = [
      { id: 'g', title: 'Группа', priority: 'must', horizon: 'now' },
      { id: 'g.a', title: 'А', parent: 'g', status: 'not_implemented' },
      { id: 'g.b', title: 'Б', parent: 'g', status: 'not_implemented' },
      { id: 'old', title: 'Старая', status: 'implemented' }
    ];
    const views = capabilityViews(caps, [
      { from: 'g.b', to: 'g.a', type: 'depends' },
      { from: 'g.a', to: 'old', type: 'replaces' }
    ], { 'g.a': cover({ tasks: { total: 1, done: 1, active: 0, ids: ['T-1'], statuses: {} } }) });

    const a = views.get('g.a');
    expect(a?.priority).toEqual({ value: 'must', inherited: true, from: 'g' });
    expect(a?.horizon?.value).toBe('now');
    expect(a?.unblocks).toBe(1);
    expect(a?.reliedOnBy).toBe(1);
    expect(a?.flags).toEqual(['behind']);
    expect(views.get('g.b')?.waiting).toEqual(['g.a']);
    expect(views.get('g.b')?.flags).toEqual(['waits']);
    expect(views.get('old')?.replacedBy).toEqual(['g.a']);
    // У родителя признаков нет: у него состояние производное.
    expect(views.get('g')?.flags).toEqual([]);
  });

  it('подписи: приоритет и горизонт, задачи, уровень риска', () => {
    const [view] = [...capabilityViews([{ id: 'a', priority: 'should', horizon: 'next' }], []).values()];
    expect(planText(view as never)).toBe('Желательно · Следом');
    expect(tasksText(undefined)).toBe('');
    expect(tasksText(cover({ tasks: { total: 5, done: 3, active: 1, ids: [], statuses: {} } }))).toBe('задачи 3/5');
    expect(riskLevel(['waits', 'ahead'])).toBe('orange');
    expect(riskLevel(['cycle'])).toBe('red');
    expect(riskLevel([])).toBe('none');
  });
});

describe('легенда вне схемы', () => {
  const caps: Caps = [
    { id: 'a', title: 'А', status: 'implemented' },
    { id: 'b', title: 'Б', status: 'not_implemented' },
    { id: 'c', title: 'В', status: 'partial' }
  ];
  const rels: Rels = [{ from: 'b', to: 'a', type: 'triggers' }, { from: 'c', to: 'a', type: 'depends' }];

  it('legendInside: false — в тексте рамки нет, данные для полосы — есть', () => {
    const { text, legend } = graph(caps, rels, null, { legendInside: false });
    expect(text).not.toContain('Легенда');
    expect(text).not.toContain('legend_');
    expect(legend?.entries.map((entry) => `${entry.label} · ${entry.count}`)).toEqual(['Реализовано · 1', 'Частично · 1', 'Не реализовано · 1']);
    expect(legend?.entries[0]).toMatchObject({ fill: '#DCFCE7', stroke: '#16A34A' });
    expect(legend?.kinds.map((kind) => `${kind.text} · ${kind.count}`)).toEqual(['зависит от · 1', 'запускает · 1']);
  });

  it('по умолчанию рамка в тексте остаётся, данные те же', () => {
    const inside = graph(caps, rels);
    expect(inside.text).toContain('subgraph legend["Легенда"]');
    expect(inside.legend).toEqual(graph(caps, rels, null, { legendInside: false }).legend);
  });

  it('в обзоре групп и в других режимах — тоже', () => {
    expect(graph(caps, rels, null, { level: 'groups', legendInside: false }).legend?.entries.length).toBeGreaterThan(0);
    const order = graph(caps, rels, null, { mode: 'order', legendInside: false }).legend;
    expect(order?.entries.map((entry) => entry.label)).toContain('Готово');
  });
});
