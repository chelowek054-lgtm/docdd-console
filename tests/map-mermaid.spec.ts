import { describe, expect, it } from 'vitest';

import { codemapMermaid, dataflowMermaid, userflowMermaid } from '../app/utils/map-mermaid';
import { emptyProjectMap, type ProjectMap } from '../server/lib/maps';

/**
 * Тот же текст показывается на экране и выгружается в документ проекта
 * (docs/07-maps.md), поэтому проверяется он, а не картинка.
 */

function mapWith(part: Partial<ProjectMap>): ProjectMap {
  return { ...emptyProjectMap(), ...part };
}

describe('codemapMermaid', () => {
  it('раскладывает модули по слоям подграфами', () => {
    const text = codemapMermaid(mapWith({
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

  it('узел, упомянутый только в связи, показывает путём, а не идентификатором', () => {
    const text = codemapMermaid(mapWith({
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

  it('пустая структура даёт пустую строку, а не пустую диаграмму', () => {
    expect(codemapMermaid(emptyProjectMap())).toBe('');
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
    expect(dataflowMermaid(flow('write'))).toContain('[("Кэш индекса")]');
  });

  it('чтение идёт стрелкой от источника — по направлению данных', () => {
    const text = dataflowMermaid(flow('read'));
    const line = text.split('\n').find((item) => item.includes('|read|')) ?? '';
    expect(line.indexOf('s_index_cache')).toBeLessThan(line.indexOf('f_server_lib_cache_ts'));
  });

  it('запись идёт стрелкой к источнику', () => {
    const text = dataflowMermaid(flow('write'));
    const line = text.split('\n').find((item) => item.includes('|write|')) ?? '';
    expect(line.indexOf('f_server_lib_cache_ts')).toBeLessThan(line.indexOf('s_index_cache'));
  });

  it('необъявленный источник всё равно назван', () => {
    const text = dataflowMermaid(mapWith({
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
    const text = userflowMermaid(mapWith({
      userflow: {
        screens: [{ id: '/projects', title: 'Проекты' }],
        transitions: [],
        calls: [{
          from: '/projects', to: 'GET /api/projects',
          evidence: { path: 'app/pages/index.vue', line: 5, fragment: 'useFetch' }
        }]
      }
    }));
    expect(text).toContain('(["GET /api/projects"])');
    expect(text).toContain('-.->');
  });

  it('подписывает переход тем, чем он вызывается', () => {
    const text = userflowMermaid(mapWith({
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
  });

  it('кавычки в заголовке не рвут диаграмму', () => {
    const text = userflowMermaid(mapWith({
      userflow: { screens: [{ id: '/x', title: 'Экран "Карты"' }], transitions: [], calls: [] }
    }));
    expect(text).toContain("Экран 'Карты'");
    expect(text).not.toContain('"Экран "');
  });
});
