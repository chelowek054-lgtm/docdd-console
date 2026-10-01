import { describe, expect, it } from 'vitest';

import {
  codemapMermaid,
  dataflowMermaid,
  flowOverviewMermaid,
  fromNodeId,
  functionalMermaid,
  groupOverviewMermaid,
  moduleNodeId,
  sourceNodeId,
  userflowMermaid
} from '../app/utils/map-mermaid';
import { codeGroupScope, flowContext, flowGhosts, groupFlows } from '../server/lib/flow-groups';
import { ghostNeighbors, groupCard, groupModules, portsOf } from '../server/lib/groups';
import { emptyProjectMap, type ProjectMap } from '../server/lib/maps';

/**
 * Тот же текст показывается на экране и выгружается в документ проекта
 * (docs/07-maps.md), поэтому проверяется он, а не картинка. `details` —
 * подсказка при наведении (MermaidDiagram.vue) — проверяется отдельно: она не
 * попадает в документ, только на экран.
 */

/** `groups` у кодовой карты в тестах необязательны: большинство из них про модули и импорты. */
type MapPart = Omit<Partial<ProjectMap>, 'codemap'> & {
  codemap?: Omit<ProjectMap['codemap'], 'groups'> & { groups?: ProjectMap['codemap']['groups'] };
};

function mapWith(part: MapPart): ProjectMap {
  const base = emptyProjectMap();
  return { ...base, ...part, codemap: part.codemap ? { groups: [], ...part.codemap } : base.codemap };
}

describe('codemapMermaid', () => {
  it('раскладывает модули по слоям подграфами', () => {
    const { text } = codemapMermaid(mapWith({
      codemap: {
        modules: [
          { id: 'server/lib/parse.ts', title: 'Разбор', layer: 'ядро' },
          { id: 'app/pages/index.vue', title: 'Проекты', layer: 'экраны' }
        ],
        imports: []
      }
    }));
    expect(text).toContain('flowchart LR');
    expect(text).toContain('["ядро"]');
    expect(text).toContain('["экраны"]');
    expect(text).toContain('["Разбор"]');
  });

  it('красит модуль по слою — классом, назначенным по имени слоя', () => {
    const { text } = codemapMermaid(mapWith({
      codemap: { modules: [{ id: 'server/lib/parse.ts', title: 'Разбор', layer: 'ядро' }], imports: [] }
    }));
    // Тот же слой между перерисовками красится в тот же класс — по имени, не по случаю.
    expect(text).toContain(':::layer_ядро');
    expect(text).toContain('classDef layer_ядро fill:');
  });

  it('узел, упомянутый только в связи, показывает путём, а не идентификатором', () => {
    const { text } = codemapMermaid(mapWith({
      codemap: {
        modules: [],
        imports: [{
          from: 'app/src/gone.ts',
          to: 'app/src/bite.ts',
          evidence: { path: 'app/src/gone.ts', line: 1, fragment: 'import' }
        }]
      }
    }));
    // Каждый узел, участвующий в связи, объявлен с подписью — иначе mermaid
    // нарисует его машинным именем вида `m_app_src_gone_ts`.
    const declared = new Set([...text.matchAll(/^\s*(\w+)\[/gm)].map((match) => match[1]));
    for (const used of [...text.matchAll(/^\s*(\w+) --> (\w+)$/gm)].flatMap((match) => [match[1], match[2]])) {
      expect(declared.has(used as string), used).toBe(true);
    }
    expect(text).toContain('["app/src/gone.ts"]');
    expect(text).toContain('["app/src/bite.ts"]');
  });

  it('подробности при наведении несут id, заголовок и слой полностью', () => {
    const { details } = codemapMermaid(mapWith({
      codemap: { modules: [{ id: 'server/lib/parse.ts', title: 'Разбор', layer: 'ядро' }], imports: [] }
    }));
    expect(details['m_server_lib_parse_ts']).toBe('server/lib/parse.ts\nРазбор\nслой: ядро');
  });

  it('пустая структура даёт пустую строку, а не пустую диаграмму', () => {
    expect(codemapMermaid(emptyProjectMap())).toEqual({ text: '', details: {}, paths: {}, nodes: {}, edges: [], neighbors: {} });
  });

  it('путь модуля — в paths по id узла, а не выдуман по module.id', () => {
    const { paths } = codemapMermaid(mapWith({
      codemap: {
        modules: [
          { id: 'gastrograf.config', title: 'Настройки', path: 'backend/gastrograf/config.py' },
          { id: 'gastrograf.domain', title: 'Домен' }
        ],
        imports: []
      }
    }));
    expect(paths['m_gastrograf_config']).toBe('backend/gastrograf/config.py');
    expect(paths['m_gastrograf_domain']).toBeUndefined();
  });

  it('nodes несёт summary и api модуля — для карточки при клике', () => {
    const { nodes } = codemapMermaid(mapWith({
      codemap: {
        modules: [{
          id: 'server/lib/parse.ts',
          title: 'Разбор',
          layer: 'ядро',
          summary: 'Читает файл записи и делит его на front matter и тело.',
          api: [{ name: 'parseRecord', kind: 'function', signature: '(text: string) => ParsedRecord' }]
        }],
        imports: []
      }
    }));
    expect(nodes['m_server_lib_parse_ts']?.summary).toContain('front matter');
    expect(nodes['m_server_lib_parse_ts']?.api?.[0]?.name).toBe('parseRecord');
  });

  it('edges несёт свидетельство и статус связи в порядке появления в тексте', () => {
    const { edges } = codemapMermaid(mapWith({
      codemap: {
        modules: [],
        imports: [
          { from: 'a.ts', to: 'b.ts', evidence: { path: 'a.ts', line: 1, fragment: 'x' }, status: 'ok' },
          { from: 'b.ts', to: 'c.ts', evidence: { path: 'b.ts', line: 2, fragment: 'y' }, status: 'stale' }
        ]
      }
    }));
    expect(edges).toEqual([
      { from: 'm_a_ts', to: 'm_b_ts', evidence: { path: 'a.ts', line: 1, fragment: 'x' }, status: 'ok' },
      { from: 'm_b_ts', to: 'm_c_ts', evidence: { path: 'b.ts', line: 2, fragment: 'y' }, status: 'stale' }
    ]);
  });

  it('несошедшееся свидетельство красит связь на диаграмме', () => {
    const { text } = codemapMermaid(mapWith({
      codemap: {
        modules: [],
        imports: [
          { from: 'a.ts', to: 'b.ts', evidence: { path: 'a.ts', line: 1, fragment: 'x' }, status: 'stale' }
        ]
      }
    }));
    expect(text).toContain('linkStyle 0 stroke:#DC2626');
  });

  it('neighbors связывает узлы в обе стороны — для подсветки соседей при клике', () => {
    const { neighbors } = codemapMermaid(mapWith({
      codemap: {
        modules: [],
        imports: [{ from: 'a.ts', to: 'b.ts', evidence: { path: 'a.ts', line: 1, fragment: 'x' } }]
      }
    }));
    expect(neighbors['m_a_ts']).toEqual(['m_b_ts']);
    expect(neighbors['m_b_ts']).toEqual(['m_a_ts']);
  });

  it('сошедшееся свидетельство связь не красит', () => {
    const { text } = codemapMermaid(mapWith({
      codemap: {
        modules: [],
        imports: [
          { from: 'a.ts', to: 'b.ts', evidence: { path: 'a.ts', line: 1, fragment: 'x' }, status: 'ok' }
        ]
      }
    }));
    expect(text).not.toContain('linkStyle');
  });
});

describe('dataflowMermaid', () => {
  const flow = (direction: string) => mapWith({
    dataflow: {
      sources: [{ id: 'index-cache', kind: 'file', where: '.docdd/index.json', title: 'Кэш индекса' }],
      flows: [{
        from: 'server/lib/cache.ts',
        to: 'index-cache',
        direction,
        evidence: { path: 'server/lib/cache.ts', line: 34, fragment: 'writeFileSync' }
      }]
    }
  });

  it('хранилище рисует цилиндром: вид источника читается без легенды', () => {
    expect(dataflowMermaid(flow('write')).text).toContain('[("Кэш индекса")]');
  });

  it('красит источник по виду (kind), а не по случайному цвету', () => {
    const { text } = dataflowMermaid(flow('write'));
    expect(text).toContain(':::kind_file');
    expect(text).toContain('classDef kind_file fill:');
  });

  it('чтение — сплошная стрелка от источника, запись — пунктир, «оба» — жирная', () => {
    const read = dataflowMermaid(flow('read')).text.split('\n').find((item) => item.includes('|read|')) ?? '';
    const write = dataflowMermaid(flow('write')).text.split('\n').find((item) => item.includes('|write|')) ?? '';
    const both = dataflowMermaid(flow('both')).text.split('\n').find((item) => item.includes('|both|')) ?? '';
    expect(read).toContain('-->');
    expect(write).toContain('-.->');
    expect(both).toContain('==>');
  });

  it('чтение идёт стрелкой от источника — по направлению данных', () => {
    const line = dataflowMermaid(flow('read')).text.split('\n').find((item) => item.includes('|read|')) ?? '';
    expect(line.indexOf('s_index_cache')).toBeLessThan(line.indexOf('f_server_lib_cache_ts'));
  });

  it('запись идёт стрелкой к источнику', () => {
    const line = dataflowMermaid(flow('write')).text.split('\n').find((item) => item.includes('|write|')) ?? '';
    expect(line.indexOf('f_server_lib_cache_ts')).toBeLessThan(line.indexOf('s_index_cache'));
  });

  it('подробности при наведении несут вид и место источника', () => {
    const { details } = dataflowMermaid(flow('read'));
    expect(details['s_index_cache']).toBe('index-cache\nКэш индекса\nвид: файл\nгде: .docdd/index.json');
  });

  it('источник kind: file с where — открывается кликом; другие виды — нет', () => {
    const { paths } = dataflowMermaid(mapWith({
      dataflow: {
        sources: [
          { id: 'index-cache', kind: 'file', where: '.docdd/index.json' },
          { id: 'graph-db', kind: 'db', where: 'postgresql://...' }
        ],
        flows: []
      }
    }));
    expect(paths['s_index_cache']).toBe('.docdd/index.json');
    expect(paths['s_graph_db']).toBeUndefined();
  });

  it('необъявленный источник всё равно назван', () => {
    const { text } = dataflowMermaid(mapWith({
      dataflow: {
        sources: [],
        flows: [{
          from: 'a.ts', to: 'postgres', direction: 'both',
          evidence: { path: 'a.ts', line: 1, fragment: 'query' }
        }]
      }
    }));
    expect(text).toContain('["postgres"]');
  });
});

describe('userflowMermaid', () => {
  it('связывает экран с маршрутом API: этим карты и сшиваются', () => {
    const { text } = userflowMermaid(mapWith({
      userflow: {
        screens: [{ id: '/projects', title: 'Проекты' }],
        transitions: [],
        calls: [{
          from: '/projects', to: 'GET /api/projects',
          evidence: { path: 'app/pages/index.vue', line: 5, fragment: 'useFetch' }
        }]
      }
    }));
    expect(text).toContain('(["GET /api/projects"]):::api');
    expect(text).toContain('-.->');
  });

  it('экран и вызов API красятся разными классами', () => {
    const { text } = userflowMermaid(mapWith({
      userflow: {
        screens: [{ id: '/projects', title: 'Проекты' }],
        transitions: [],
        calls: [{ from: '/projects', to: 'GET /api/projects', evidence: { path: 'a', line: 1, fragment: 'x' } }]
      }
    }));
    expect(text).toContain(':::screen');
    expect(text).toContain(':::api');
  });

  it('подписывает переход тем, чем он вызывается — сплошной стрелкой', () => {
    const { text } = userflowMermaid(mapWith({
      userflow: {
        screens: [{ id: '/a' }, { id: '/b' }],
        transitions: [{
          from: '/a', to: '/b', trigger: 'ссылка в навигации',
          evidence: { path: 'app/layouts/default.vue', line: 12, fragment: 'NuxtLink' }
        }],
        calls: []
      }
    }));
    expect(text).toContain('|ссылка в навигации|');
    expect(text).toContain('u__a -->|ссылка в навигации| u__b');
  });

  it('переход без известного триггера рисуется пунктиром — карта не выдумывает, чем он вызван', () => {
    const { text } = userflowMermaid(mapWith({
      userflow: {
        screens: [{ id: '/a' }, { id: '/b' }],
        transitions: [{ from: '/a', to: '/b', evidence: { path: 'a', line: 1, fragment: 'x' } }],
        calls: []
      }
    }));
    expect(text).toContain('u__a -.-> u__b');
  });

  it('подробности при наведении несут id, заголовок и файл экрана', () => {
    const { details } = userflowMermaid(mapWith({
      userflow: { screens: [{ id: '/projects', title: 'Проекты', file: 'app/pages/index.vue' }], transitions: [], calls: [] }
    }));
    expect(details['u__projects']).toBe('/projects\nПроекты\nфайл: app/pages/index.vue');
  });

  it('файл экрана открывается кликом; экран без файла — нет', () => {
    const { paths } = userflowMermaid(mapWith({
      userflow: {
        screens: [{ id: '/projects', file: 'app/pages/index.vue' }, { id: '/about' }],
        transitions: [],
        calls: []
      }
    }));
    expect(paths['u__projects']).toBe('app/pages/index.vue');
    expect(paths['u__about']).toBeUndefined();
  });

  it('edges несёт переходы раньше вызовов — тем же порядком, что и в тексте', () => {
    const { edges } = userflowMermaid(mapWith({
      userflow: {
        screens: [{ id: '/a' }, { id: '/b' }],
        transitions: [{ from: '/a', to: '/b', evidence: { path: 'x', line: 1, fragment: 'y' } }],
        calls: [{ from: '/a', to: 'GET /api', evidence: { path: 'x', line: 2, fragment: 'z' } }]
      }
    }));
    expect(edges.map((edge) => edge.evidence.fragment)).toEqual(['y', 'z']);
  });

  it('кавычки в заголовке не рвут диаграмму', () => {
    const { text } = userflowMermaid(mapWith({
      userflow: { screens: [{ id: '/x', title: 'Экран "Карты"' }], transitions: [], calls: [] }
    }));
    expect(text).toContain("Экран 'Карты'");
    expect(text).not.toContain('"Экран "');
  });
});

describe('functionalMermaid', () => {
  const functional = (
    capabilities: ProjectMap['functional']['capabilities'],
    relations: ProjectMap['functional']['relations'] = []
  ) => mapWith({ functional: { capabilities, relations, vision: null } });

  it('родитель — рамка вокруг подпунктов, со счётом реализованных', () => {
    const { text } = functionalMermaid(functional([
      { id: 'orders', title: 'Заказы' },
      { id: 'orders.pay', title: 'Оплата', parent: 'orders', status: 'implemented' },
      { id: 'orders.cancel', title: 'Отмена', parent: 'orders', status: 'not_implemented' }
    ]));
    expect(text).toContain('flowchart LR');
    expect(text).toContain('subgraph f_orders["Заказы · 1 из 2"]');
    // Лист внутри рамки: отступ больше, чем у самой рамки.
    const lines = text.split('\n');
    const indentOf = (line: string | undefined) => (line?.match(/^ */)?.[0] ?? '').length;
    const frame = lines.find((line) => line.includes('subgraph f_orders'));
    const leaf = lines.find((line) => line.includes('f_orders_pay['));
    expect(indentOf(leaf)).toBeGreaterThan(indentOf(frame));
  });

  it('цвет и слово — по состоянию; не оценённая — отдельным классом', () => {
    const { text } = functionalMermaid(functional([
      { id: 'a', title: 'А', status: 'implemented' },
      { id: 'b', title: 'Б', status: 'partial' },
      { id: 'c', title: 'В', status: 'not_implemented' },
      { id: 'd', title: 'Г' }
    ]));
    expect(text).toContain('f_a["А<br/>Реализовано"]:::st_implemented');
    expect(text).toContain('f_b["Б<br/>Частично"]:::st_partial');
    expect(text).toContain('f_c["В<br/>Не реализовано"]:::st_not_implemented');
    expect(text).toContain('f_d["Г<br/>Не оценено"]:::st_unrated');
  });

  it('связи — тремя видами стрелок, с подписью', () => {
    const { text, neighbors } = functionalMermaid(functional(
      [{ id: 'a', title: 'А' }, { id: 'b', title: 'Б' }, { id: 'c', title: 'В' }],
      [
        { from: 'a', to: 'b', type: 'depends' },
        { from: 'a', to: 'c', type: 'uses', summary: 'профиль' },
        { from: 'b', to: 'c', type: 'feeds' }
      ]
    ));
    expect(text).toContain('f_a --> f_b');
    expect(text).toContain('f_a -.->|"профиль"| f_c');
    expect(text).toContain('f_b ==> f_c');
    expect(neighbors['f_a']).toEqual(['f_b', 'f_c']);
  });

  it('связь без возможности на конце и связь с предком не рисуются', () => {
    const { text } = functionalMermaid(functional(
      [{ id: 'a', title: 'А' }, { id: 'a.x', title: 'Х', parent: 'a' }],
      [
        { from: 'a', to: 'нет', type: 'uses' },
        { from: 'a.x', to: 'a', type: 'depends' }
      ]
    ));
    expect(text).not.toContain('-->');
    expect(text).not.toContain('-.->');
  });

  it('цикл по depends краснеет, ждущая связь — жёлтая', () => {
    const cycle = functionalMermaid(functional(
      [{ id: 'a', title: 'А' }, { id: 'b', title: 'Б' }],
      [{ from: 'a', to: 'b', type: 'depends' }, { from: 'b', to: 'a', type: 'depends' }]
    ));
    expect(cycle.text).toContain('linkStyle 0 stroke:#DC2626');
    expect(cycle.text).toContain('linkStyle 1 stroke:#DC2626');

    const waiting = functionalMermaid(functional(
      [{ id: 'a', title: 'А', status: 'partial' }, { id: 'b', title: 'Б', status: 'not_implemented' }],
      [{ from: 'a', to: 'b', type: 'depends' }]
    ));
    expect(waiting.text).toContain('linkStyle 0 stroke:#D97706');
  });

  it('фильтр оставляет листья нужного состояния и их предков', () => {
    const { text } = functionalMermaid(functional([
      { id: 'orders', title: 'Заказы' },
      { id: 'orders.pay', title: 'Оплата', parent: 'orders', status: 'implemented' },
      { id: 'orders.cancel', title: 'Отмена', parent: 'orders', status: 'not_implemented' },
      { id: 'other', title: 'Прочее', status: 'implemented' }
    ]), 'not_implemented');
    expect(text).toContain('f_orders_cancel[');
    expect(text).toContain('subgraph f_orders');
    expect(text).not.toContain('f_orders_pay[');
    expect(text).not.toContain('f_other[');
    // Состояние родителя считается по всему дереву, а не по тому, что осталось под фильтром.
    expect(text).toContain('Заказы · 1 из 2');
  });

  it('узел несёт состояние, связи и note для карточки', () => {
    const { nodes, details } = functionalMermaid(functional(
      [{ id: 'a', title: 'А', status: 'partial', note: 'нет возвратов' }, { id: 'b', title: 'Б' }],
      [{ from: 'a', to: 'b', type: 'depends' }]
    ));
    expect(nodes['f_a']?.note).toBe('нет возвратов');
    expect(nodes['f_a']?.capabilityView?.status).toBe('partial');
    expect(nodes['f_a']?.capabilityView?.links).toEqual([
      { direction: 'out', type: 'depends', id: 'b', title: 'Б', summary: undefined }
    ]);
    expect(nodes['f_b']?.capabilityView?.links[0]?.direction).toBe('in');
    expect(details['f_a']).toBe('a\nА\nЧастично\nнет возвратов');
  });

  it('ссылка на несуществующего родителя не теряет возможность', () => {
    const { text } = functionalMermaid(functional([{ id: 'orphan', title: 'Одна', parent: 'нет-такой' }]));
    expect(text).toContain('f_orphan[');
  });

  it('повторный id не рисует один узел дважды в разных ветках', () => {
    const { text } = functionalMermaid(functional([
      { id: 'a', title: 'Первая' },
      { id: 'b', title: 'Б', parent: 'a' },
      // Тот же id 'a', но объявлен потомком 'b' — без защиты узел 'a'
      // нарисовался бы и корнем, и веткой глубже одновременно.
      { id: 'a', title: 'Вторая', parent: 'b' }
    ]));
    expect(text.match(/f_a\[|subgraph f_a\[/g)).toHaveLength(1);
  });

  it('кавычки в названии не рвут диаграмму', () => {
    const { text } = functionalMermaid(functional([{ id: 'x', title: 'Отчёты "PDF"' }]));
    expect(text).toContain("Отчёты 'PDF'");
  });

  it('пустая структура даёт пустую строку, а не пустую диаграмму', () => {
    expect(functionalMermaid(emptyProjectMap())).toEqual({ text: '', details: {}, paths: {}, nodes: {}, edges: [], neighbors: {} });
  });
});

describe('группы кодовой карты на диаграмме', () => {
  const ev = (fragment: string) => ({ path: 'x.ts', line: 1, fragment });
  const modules = [
    { id: 'server/lib/a.ts', title: 'А', layer: 'ядро' },
    { id: 'server/lib/b.ts', title: 'Б', layer: 'ядро' },
    { id: 'app/pages/x.vue', title: 'Экран', layer: 'экраны' },
    { id: 'cli/check.ts', title: 'Проверка', layer: 'cli' }
  ];
  const imports = [
    { from: 'server/lib/a.ts', to: 'server/lib/b.ts', evidence: ev('a>b') },
    { from: 'app/pages/x.vue', to: 'server/lib/a.ts', evidence: ev('x>a'), status: 'ok' as const },
    { from: 'app/pages/x.vue', to: 'server/lib/b.ts', evidence: ev('x>b'), status: 'stale' as const },
    { from: 'server/lib/b.ts', to: 'cli/check.ts', evidence: ev('b>c') },
    { from: 'cli/check.ts', to: 'server/lib/a.ts', evidence: ev('c>a') }
  ];
  const grouping = groupModules(modules, imports);

  it('обзор: узел — группа с числом модулей и пометкой «авто», стрелка — число импортов', () => {
    const { text, nodes, edges } = groupOverviewMermaid(grouping);
    expect(text).toContain('g_server_lib["server/lib<br/>2 модуля · авто"]');
    expect(text).toContain('g_app_pages["app/pages<br/>1 модуль · авто"]');
    expect(text).toContain('g_app_pages -->|2| g_server_lib');
    expect(nodes['g_server_lib']?.group?.moduleCount).toBe(2);
    expect(edges.find((edge) => edge.link?.fromGroup === 'app/pages')?.link?.imports).toHaveLength(2);
  });

  it('расхождение хоть в одном импорте краснит всю стрелку; цикл — янтарная', () => {
    const { text } = groupOverviewMermaid(grouping);
    // Порядок связей: app→server (stale), server→cli, cli→server.
    expect(text).toMatch(/linkStyle 0 stroke:#DC2626/);
    expect(text).toMatch(/linkStyle 1 stroke:#D97706/);
    expect(text).toMatch(/linkStyle 2 stroke:#D97706/);
  });

  it('пустой проект — пустая строка', () => {
    expect(groupOverviewMermaid(groupModules([], []))).toEqual(
      { text: '', details: {}, paths: {}, nodes: {}, edges: [], neighbors: {} }
    );
  });

  it('вид группы: порты обведены, а призраки выбранного модуля — отдельной рамкой с подписью группы', () => {
    const scoped = { codemap: { modules: grouping.byId.get('server/lib')?.members as never, imports: [imports[0]] as never } };
    const { ghosts, imports: ghostImports } = ghostNeighbors(grouping, 'server/lib', 'server/lib/a.ts', modules, imports);
    const { text, nodes, edges, neighbors } = codemapMermaid(
      mapWith(scoped),
      { ports: portsOf(grouping, 'server/lib', imports), ghosts, ghostImports, ghostCards: new Map([['cli', groupCard(grouping, 'cli') as never]]) }
    );
    expect(text).toContain('classDef port stroke-width:3px;');
    expect(text).toContain(`class ${moduleNodeId('server/lib/a.ts')},${moduleNodeId('server/lib/b.ts')} port;`);
    expect(text).toContain('subgraph ghosts["Из других групп"]');
    expect(text).toContain('m_app_pages_x_vue["Экран<br/>из группы app/pages"]:::ghost');
    expect(nodes['m_app_pages_x_vue']?.ghost).toEqual({ groupId: 'app/pages', groupTitle: 'app/pages' });
    expect(nodes[moduleNodeId('server/lib/a.ts')]?.port).toBe(true);
    // Связи с призраками — обычные рёбра диаграммы, из них же и соседи для подсветки.
    expect(edges).toHaveLength(1 + ghostImports.length);
    expect(neighbors['m_server_lib_a_ts']).toContain('m_app_pages_x_vue');
  });

  it('без выбора ни призраков, ни их рамки', () => {
    const { text } = codemapMermaid(mapWith({ codemap: { modules: [{ id: 'a' }], imports: [] } }));
    expect(text).not.toContain('ghost');
    expect(text).not.toContain('classDef port');
  });
});

describe('группы на потоках данных', () => {
  const ev = (fragment: string) => ({ path: 'x.ts', line: 1, fragment });
  const modules = [{ id: 'server/lib/a.ts' }, { id: 'server/lib/b.ts' }, { id: 'server/api/x.ts' }, { id: 'cli/check.ts' }];
  const sources = [
    { id: 'cache.db', kind: 'db' }, { id: 'index.json', kind: 'file', where: 'index.json' }, { id: 'mq', kind: 'queue' }
  ];
  const flows = [
    { from: 'server/lib/a.ts', to: 'cache.db', direction: 'read', evidence: ev('a>db') },
    { from: 'server/lib/b.ts', to: 'cache.db', direction: 'write', evidence: ev('b>db'), status: 'stale' as const },
    { from: 'server/api/x.ts', to: 'cache.db', direction: 'read', evidence: ev('x>db') },
    { from: 'cli/check.ts', to: 'index.json', direction: 'both', evidence: ev('c>f') },
    { from: 'server/api/x.ts', to: 'mq', direction: 'write', evidence: ev('x>mq') }
  ];
  const codeGrouping = groupModules(modules, []);
  const context = flowContext(codeGrouping, [], sources);
  const grouping = groupFlows(flows, context);

  it('обзор: группы кода и виды источников, стрелки по направлению данных, подпись — число потоков', () => {
    const { text, nodes, edges } = flowOverviewMermaid(grouping, new Map());
    expect(text).toContain('gf_server_lib["server/lib<br/>2 потоков"]');
    expect(text).toContain('gk_db[("база данных<br/>1 источник")]');
    // server/lib: чтение и запись к db — «оба», жирная; server/api только читает — от источника к коду.
    expect(text).toContain('gf_server_lib ==>|2| gk_db');
    expect(text).toContain('gk_db -->|1| gf_server_api');
    expect(text).toContain('gf_server_api -.->|1| gk_queue');
    expect(nodes['gf_server_lib']?.flowGroup).toEqual({ type: 'code', id: 'server/lib' });
    expect(nodes['gk_db']?.flowGroup).toEqual({ type: 'kind', id: 'db' });
    expect(edges.find((edge) => edge.link?.fromGroup === 'server/lib')?.link).toMatchObject({
      toTitle: 'база данных', direction: 'both', directionText: 'читают и пишут', status: 'stale'
    });
  });

  it('расхождение хоть в одном потоке краснит связь', () => {
    const { text } = flowOverviewMermaid(grouping, new Map());
    expect(text).toMatch(/linkStyle \d+ stroke:#DC2626/);
  });

  it('потоков нет — пустая строка', () => {
    expect(flowOverviewMermaid(groupFlows([], context), new Map()).text).toBe('');
  });

  it('вид группы: модули кликабельны, призраки — отдельной рамкой с потоками к источнику', () => {
    const scope = codeGroupScope(context, 'server/lib', flows);
    const { ghosts, flows: ghostFlows } = flowGhosts(context, 'server/lib', 'server/lib/a.ts', flows);
    const { text, nodes, edges, neighbors } = dataflowMermaid(
      mapWith({ dataflow: { sources: scope.sources as never, flows: scope.flows as never } }),
      { selectableFrom: true, ghosts, ghostFlows }
    );
    expect(nodes[fromNodeId('server/lib/a.ts')]).toEqual({ id: 'server/lib/a.ts', title: 'server/lib/a.ts' });
    expect(text).toContain('subgraph ghosts["Из других групп"]');
    expect(text).toContain('f_server_api_x_ts["server/api/x.ts<br/>из группы server/api"]:::ghost');
    expect(nodes['f_server_api_x_ts']?.ghost).toEqual({ groupId: 'server/api', groupTitle: 'server/api' });
    expect(edges).toHaveLength(scope.flows.length + ghostFlows.length);
    expect(neighbors[sourceNodeId('cache.db')]).toContain('f_server_api_x_ts');
  });

  it('без параметров диаграмма потоков прежняя: узлы «откуда» не кликабельны, призраков нет', () => {
    const { text, nodes } = dataflowMermaid(mapWith({ dataflow: { sources: sources as never, flows: flows as never } }));
    expect(text).not.toContain('ghost');
    expect(nodes[fromNodeId('server/lib/a.ts')]).toBeUndefined();
  });
});
