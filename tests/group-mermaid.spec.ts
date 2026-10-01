import { describe, expect, it } from 'vitest';

import { buildGroups } from '../server/lib/groups';
import { MAX_GHOSTS, groupCardOf, groupMermaid, groupsOverviewMermaid, type GroupedCodemap } from '../app/utils/group-mermaid';

/**
 * Три уровня кодовой карты (docs/04-ui.md, «Группы кодовой карты»): обзор,
 * группа, выбранный модуль. Проверяется текст mermaid и данные карточек, а не
 * картинка — тем же способом, что у остальных видов (map-mermaid.spec.ts).
 */

const evidence = { path: 'x.ts', line: 1, fragment: 'import' };

function module(path: string, layer = 'ядро') {
  return { id: path, title: path.split('/').pop(), path, layer };
}

function edge(from: string, to: string, status?: 'ok' | 'stale' | 'pending') {
  return { from, to, evidence, status };
}

const codemap: GroupedCodemap = {
  modules: [
    module('server/lib/a.ts'),
    module('server/lib/b.ts'),
    module('server/api/x.ts', 'маршруты'),
    module('app/pages/p.vue', 'экраны'),
    module('app/pages/q.vue', 'экраны')
  ],
  imports: [
    edge('server/lib/a.ts', 'server/lib/b.ts', 'ok'),
    edge('server/api/x.ts', 'server/lib/a.ts', 'ok'),
    edge('server/api/x.ts', 'server/lib/b.ts', 'stale'),
    edge('app/pages/p.vue', 'server/api/x.ts', 'ok'),
    edge('server/lib/b.ts', 'app/pages/q.vue', 'ok')
  ]
};

const model = buildGroups(codemap.modules, codemap.imports);
const byId = new Map(codemap.modules.map((item) => [item.id, item]));

describe('groupsOverviewMermaid', () => {
  const view = groupsOverviewMermaid(model, byId);

  it('узлы — группы с числом модулей, автогруппа помечена «авто»', () => {
    expect(view.text).toContain('flowchart LR');
    expect(view.text).toContain('["server/lib<br/>2 модуля · авто"]');
    expect(view.text).toContain('["app/pages<br/>2 модуля · авто"]');
    expect(view.text).toContain('["server/api<br/>1 модуль · авто"]');
  });

  it('размер узла растёт с числом модулей: самая крупная группа — самый крупный класс', () => {
    expect(view.text).toMatch(/g_server_lib\[[^\n]*\]:::gsize_3/);
    // Один модуль из двух — уже больше сорока процентов от самой крупной.
    expect(view.text).toMatch(/g_server_api\[[^\n]*\]:::gsize_2/);
  });

  it('стрелка — свёртка импортов с числом; импорт внутри группы стрелкой не становится', () => {
    expect(view.text).toContain('g_server_api -->|2 импорта| g_server_lib');
    expect(view.text).not.toContain('g_server_lib --> g_server_lib');
    expect(view.edges).toHaveLength(3);
  });

  it('вердикт стрелки худший из свёрнутых: красится на самой стрелке', () => {
    const apiToLib = view.edges.findIndex((item) => item.groupLink?.fromGroup === 'server/api' && item.groupLink.toGroup === 'server/lib');
    expect(view.edges[apiToLib]?.groupLink?.status).toBe('stale');
    expect(view.text).toContain(`linkStyle ${apiToLib} stroke:#DC2626`);
  });

  it('раскрытие стрелки несёт исходные импорты со свидетельствами', () => {
    const link = view.edges.find((item) => item.groupLink?.fromGroup === 'server/api')?.groupLink;
    expect(link?.count).toBe(2);
    expect(link?.imports.map((item) => item.to).sort()).toEqual(['server/lib/a.ts', 'server/lib/b.ts']);
    expect(link?.imports.every((item) => item.evidence.path === 'x.ts')).toBe(true);
  });

  it('карточка узла — карточка группы: состав, поверхность и связи с другими группами', () => {
    const card = view.nodes['g_server_lib']?.group;
    expect(card).toMatchObject({ id: 'server/lib', auto: true, modules: 2 });
    expect(card?.surface.map((item) => item.id)).toEqual(['server/lib/a.ts', 'server/lib/b.ts']);
    expect(card?.links.map((item) => `${item.direction}:${item.other}`).sort()).toEqual(['in:server/api', 'out:app/pages']);
  });

  it('цикл между группами подсвечен на узлах и стрелках', () => {
    const cyclic = buildGroups(codemap.modules, [
      edge('server/api/x.ts', 'server/lib/a.ts'),
      edge('server/lib/b.ts', 'server/api/x.ts')
    ]);
    const out = groupsOverviewMermaid(cyclic, byId);
    expect(out.text).toContain('class g_server_api,g_server_lib gcycle;');
    expect(out.text).toContain('stroke:#EA580C');
    expect(out.edges.every((item) => item.groupLink?.cycle)).toBe(true);
  });

  it('вердикт pending рисуется пунктиром, а не красным: сверка не запущена, а не провалена', () => {
    const pending = buildGroups(codemap.modules, [edge('server/api/x.ts', 'server/lib/a.ts', 'pending')]);
    const out = groupsOverviewMermaid(pending, byId);
    expect(out.text).toContain('g_server_api -.->|1 импорт| g_server_lib');
    expect(out.text).not.toContain('stroke:#DC2626');
  });

  it('пустая карта — пустой вывод, а не пустая диаграмма', () => {
    expect(groupsOverviewMermaid(buildGroups([], []), new Map())).toEqual({
      text: '', details: {}, paths: {}, nodes: {}, edges: [], neighbors: {}
    });
  });
});

describe('groupMermaid: группа целиком', () => {
  const view = groupMermaid(codemap, model, 'server/lib');

  it('модули группы — слоями, как кодовая карта сегодня; чужих модулей среди узлов нет', () => {
    expect(view.text).toContain('subgraph layer_ядро["ядро"]');
    expect(view.text).toContain('m_server_lib_a_ts["a.ts"]');
    expect(view.text).not.toContain('m_server_api_x_ts[');
    expect(view.text).toContain('m_server_lib_a_ts --> m_server_lib_b_ts');
  });

  it('порты обведены толстой рамкой — отдельным классом, не заменяя цвет слоя', () => {
    expect(view.text).toContain('classDef port stroke-width:4px;');
    expect(view.text).toContain('class m_server_lib_a_ts,m_server_lib_b_ts port;');
    expect(view.nodes['m_server_lib_a_ts']?.port).toBe(true);
  });

  it('внешние связи без выбора модуля — узлы-группы по краям, одна стрелка от порта к группе', () => {
    expect(view.text).toContain('x_server_api["server/api<br/>1 модуль"]:::ext');
    expect(view.text).toContain('x_app_pages["app/pages<br/>2 модуля"]:::ext');
    expect(view.text).toContain('x_server_api --> m_server_lib_a_ts');
    expect(view.text).not.toContain(':::ghost');
    expect(view.nodes['x_server_api']?.group?.id).toBe('server/api');
  });

  it('свёрнутая стрелка несёт импорты и вердикт: сверка не теряется', () => {
    const bad = view.edges.find((item) => item.groupLink?.imports.some((i) => i.to === 'server/lib/b.ts' && i.status === 'stale'));
    expect(bad?.groupLink?.status).toBe('stale');
    expect(bad?.groupLink?.fromGroup).toBe('server/api');
  });

  it('несколько импортов порта в одну чужую группу — одна стрелка с числом', () => {
    const many = {
      modules: codemap.modules,
      imports: [edge('server/lib/a.ts', 'app/pages/p.vue'), edge('server/lib/a.ts', 'app/pages/q.vue')]
    };
    const out = groupMermaid(many, buildGroups(many.modules, many.imports), 'server/lib');
    expect(out.text).toContain('m_server_lib_a_ts -->|2| x_app_pages');
    expect(out.edges.filter((item) => item.groupLink)).toHaveLength(1);
  });

  it('спрятанный чипом слой не рисуется, а его соседи по группе не считаются чужими', () => {
    const out = groupMermaid(codemap, model, 'server/lib', { hiddenLayers: new Set(['ядро']) });
    expect(out.text).toBe('');
  });

  it('неизвестная группа — пустой вывод', () => {
    expect(groupMermaid(codemap, model, 'нет-такой').text).toBe('');
  });
});

describe('groupMermaid: выбранный модуль', () => {
  it('соседи из других групп — призраки: пунктир, подпись «из группы X», без свёрнутых узлов у него', () => {
    const view = groupMermaid(codemap, model, 'server/lib', { focus: 'server/lib/a.ts' });
    expect(view.text).toContain('ghost_server_api_x_ts["x.ts<br/>из группы server/api"]:::ghost');
    expect(view.text).toContain('classDef ghost fill:#FFFFFF,stroke:#6B7280,stroke-dasharray:4 2,opacity:0.65');
    expect(view.text).toContain('ghost_server_api_x_ts --> m_server_lib_a_ts');
    expect(view.text).toContain('class m_server_lib_a_ts focus;');
    expect(view.nodes['ghost_server_api_x_ts']?.ghostOf).toBe('server/api');
  });

  it('у остальных портов внешние связи остаются свёрнутыми: призраки только у выбранного', () => {
    const view = groupMermaid(codemap, model, 'server/lib', { focus: 'server/lib/a.ts' });
    // b.ts не выбран: его связи с server/api и app/pages — узлами-группами.
    expect(view.text).toContain('x_server_api --> m_server_lib_b_ts');
    expect(view.text).toContain('m_server_lib_b_ts --> x_app_pages');
    expect(view.text).not.toContain('ghost_app_pages');
  });

  it(`больше ${MAX_GHOSTS} соседей из других групп — не призраки, а узлы-группы`, () => {
    const others = Array.from({ length: MAX_GHOSTS + 1 }, (_, index) => module(`lib/dep${index}/m.ts`));
    const big: GroupedCodemap = {
      modules: [module('server/lib/a.ts'), ...others],
      imports: others.map((item) => edge('server/lib/a.ts', item.id))
    };
    const view = groupMermaid(big, buildGroups(big.modules, big.imports), 'server/lib', { focus: 'server/lib/a.ts' });
    expect(view.text).not.toContain(':::ghost');
    expect(view.text).toContain(':::ext');
  });

  it(`ровно ${MAX_GHOSTS} соседей — ещё призраки`, () => {
    const others = Array.from({ length: MAX_GHOSTS }, (_, index) => module(`lib/dep${index}/m.ts`));
    const edge12: GroupedCodemap = {
      modules: [module('server/lib/a.ts'), ...others],
      imports: others.map((item) => edge('server/lib/a.ts', item.id))
    };
    const view = groupMermaid(edge12, buildGroups(edge12.modules, edge12.imports), 'server/lib', { focus: 'server/lib/a.ts' });
    expect(view.text.match(/:::ghost/g)).toHaveLength(MAX_GHOSTS);
  });

  it('выбран модуль не из этой группы — это обычный вид группы, без призраков', () => {
    const view = groupMermaid(codemap, model, 'server/lib', { focus: 'server/api/x.ts' });
    expect(view.text).not.toContain(':::ghost');
    expect(view.text).not.toContain('focus;');
  });
});

describe('groupCardOf', () => {
  it('число модулей, поверхность и связи в обе стороны', () => {
    const group = model.groups.find((item) => item.id === 'server/api');
    const card = groupCardOf(model, group!, byId);
    expect(card.modules).toBe(1);
    // Эту группу импортирует app/pages, значит x.ts — её публичная поверхность.
    expect(card.surface.map((item) => item.id)).toEqual(['server/api/x.ts']);
    expect(card.links.map((item) => `${item.direction}:${item.other}:${item.count}`).sort()).toEqual([
      'in:app/pages:1', 'out:server/lib:2'
    ]);
  });
});

describe('groupMermaid: слой модуля без записи в карте', () => {
  // Модуль назван только в импорте: карта его не описала, и слоя у неё нет.
  const only: GroupedCodemap = {
    modules: [module('code/backend/src/app/db.py', 'ядро')],
    imports: [edge('code/backend/src/app/db.py', 'code/backend/src/app/modules/access/__init__.py')]
  };
  const onlyModel = buildGroups(only.modules, only.imports);

  it('слой берётся по папке файла, а не «без слоя»', () => {
    const view = groupMermaid(only, onlyModel, 'code/backend');
    expect(view.text).toContain('subgraph layer_modules["modules"]');
    expect(view.text).not.toContain('без слоя');
    expect(view.nodes['m_code_backend_src_app_modules_access___init___py']?.layer).toBe('modules');
  });

  it('и спрятать его чипом можно, как любой описанный слой', () => {
    const view = groupMermaid(only, onlyModel, 'code/backend', { hiddenLayers: new Set(['modules']) });
    expect(view.text).not.toContain('layer_modules');
    expect(view.text).toContain('layer_ядро');
  });
});
