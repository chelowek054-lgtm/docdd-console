import { describe, expect, it } from 'vitest';

import { codemapMermaid, dataflowMermaid, functionalMermaid, userflowMermaid } from '../app/utils/map-mermaid';
import { emptyProjectMap, type ProjectMap } from '../server/lib/maps';

/**
 * Тот же текст показывается на экране и выгружается в документ проекта
 * (docs/07-maps.md), поэтому проверяется он, а не картинка. `details` —
 * подсказка при наведении (MermaidDiagram.vue) — проверяется отдельно: она не
 * попадает в документ, только на экран.
 */

function mapWith(part: Partial<ProjectMap>): ProjectMap {
  return { ...emptyProjectMap(), ...part };
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
  it('одна верхняя возможность становится корнем без обёртки', () => {
    const { text } = functionalMermaid(mapWith({
      functional: {
        capabilities: [
          { id: 'orders', title: 'Заказы' },
          { id: 'orders.pay', title: 'Оплата', parent: 'orders' }
        ]
      }
    }));
    expect(text).toContain('mindmap');
    expect(text).not.toContain('root((Проект))');
    expect(text).toContain('f_orders(Заказы)');
    expect(text).toContain('f_orders_pay(Оплата)');
    // Вложенность — отступом: у ребёнка отступ больше, чем у родителя.
    const parentAt = text.split('\n').findIndex((line) => line.includes('f_orders('));
    const childAt = text.split('\n').findIndex((line) => line.includes('f_orders_pay('));
    const indentOf = (line: string) => (line.match(/^ */)?.[0] ?? '').length;
    const lines = text.split('\n');
    expect(indentOf(lines[childAt] ?? '')).toBeGreaterThan(indentOf(lines[parentAt] ?? ''));
  });

  it('подробности при наведении несут id и заголовок возможности', () => {
    const { details } = functionalMermaid(mapWith({
      functional: { capabilities: [{ id: 'orders', title: 'Заказы' }] }
    }));
    expect(details['f_orders']).toBe('orders\nЗаказы');
  });

  it('несколько верхних возможностей собираются под общим узлом', () => {
    const { text } = functionalMermaid(mapWith({
      functional: {
        capabilities: [
          { id: 'orders', title: 'Заказы' },
          { id: 'billing', title: 'Биллинг' }
        ]
      }
    }));
    expect(text).toContain('root((Проект))');
    expect(text).toContain('f_orders(Заказы)');
    expect(text).toContain('f_billing(Биллинг)');
  });

  it('ссылка на несуществующего родителя не теряет возможность', () => {
    const { text } = functionalMermaid(mapWith({
      functional: { capabilities: [{ id: 'orphan', title: 'Одна', parent: 'нет-такой' }] }
    }));
    expect(text).toContain('f_orphan(Одна)');
  });

  it('повторный id не рисует один узел дважды в разных ветках', () => {
    const { text } = functionalMermaid(mapWith({
      functional: {
        capabilities: [
          { id: 'a', title: 'Первая' },
          { id: 'b', title: 'Б', parent: 'a' },
          // Тот же id 'a', но объявлен потомком 'b' — без защиты узел 'a'
          // нарисовался бы и корнем, и веткой глубже одновременно.
          { id: 'a', title: 'Вторая', parent: 'b' }
        ]
      }
    }));
    expect(text.match(/f_a\(/g)).toHaveLength(1);
  });

  it('скобки в названии не рвут синтаксис узла', () => {
    const { text } = functionalMermaid(mapWith({
      functional: { capabilities: [{ id: 'x', title: 'Отчёты (PDF)' }] }
    }));
    expect(text).not.toMatch(/\(Отчёты \(PDF\)\)/);
  });

  it('пустая структура даёт пустую строку, а не пустую диаграмму', () => {
    expect(functionalMermaid(emptyProjectMap())).toEqual({ text: '', details: {}, paths: {}, nodes: {}, edges: [], neighbors: {} });
  });
});
