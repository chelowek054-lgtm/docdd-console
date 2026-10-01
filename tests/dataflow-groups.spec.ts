import { describe, expect, it } from 'vitest';

import {
  bucketOf, bucketsOf, dataflowOverviewMermaid, flowGroupResolver, scopeDataflow, type DataflowShape
} from '../app/utils/dataflow-groups';
import { OTHER_GROUP, buildGroups } from '../server/lib/groups';

/**
 * Потоки данных по тем же группам (docs/07-maps.md, «Группы»; docs/04-ui.md,
 * «Группы кодовой карты»): код — из групп кодовой карты, источники — по `kind`
 * или по своему `group`.
 */

const evidence = { path: 'x.ts', line: 1, fragment: 'open' };
const flow = (from: string, to: string, direction: 'read' | 'write' | 'both', status?: 'ok' | 'stale') =>
  ({ from, to, direction, evidence, status });

const modules = [
  { id: 'server/lib/graph.ts', path: 'server/lib/graph.ts' },
  { id: 'server/api/x.ts', path: 'server/api/x.ts' },
  { id: 'app/pages/p.vue', path: 'app/pages/p.vue' }
];
const model = buildGroups(modules, []);
const groupOf = flowGroupResolver(model, modules);

const data: DataflowShape = {
  sources: [
    { id: 'pg', kind: 'db', title: 'PostgreSQL' },
    { id: 'cache', kind: 'db' },
    { id: 'seed', kind: 'file', where: 'data/seed.json' },
    { id: 'ai', kind: 'http', title: 'AI-шлюз', group: 'внешние сервисы' }
  ],
  flows: [
    flow('server/lib/graph.ts', 'pg', 'both', 'ok'),
    flow('server/lib/graph.ts', 'cache', 'read'),
    flow('server/api/x.ts', 'pg', 'read', 'stale'),
    flow('server/api/x.ts', 'ai', 'write'),
    flow('какая-то-функция', 'seed', 'read')
  ]
};

describe('bucketOf и bucketsOf', () => {
  it('свёртка источника — его group, а нет — вид словами', () => {
    expect(bucketOf({ kind: 'db' })).toBe('база данных');
    expect(bucketOf({ kind: 'http', group: 'внешние сервисы' })).toBe('внешние сервисы');
    expect(bucketOf({ kind: 'env' })).toBe('переменная окружения');
  });

  it('источники одной свёртки лежат вместе; крупные первыми', () => {
    const buckets = bucketsOf(data);
    expect(buckets.map((bucket) => [bucket.id, bucket.sources.length])).toEqual([
      // При равном числе источников — по коду символов, а не по случаю обхода.
      ['база данных', 2], ['внешние сервисы', 1], ['файл', 1]
    ]);
  });

  it('поток к необъявленному источнику не теряется: у него своя свёртка', () => {
    const buckets = bucketsOf({ sources: [], flows: [flow('a', 'неизвестный', 'read')] });
    expect(buckets).toEqual([{ id: 'неизвестный', sources: [], implicit: true }]);
  });
});

describe('flowGroupResolver', () => {
  it('from, совпавший с id или path модуля, — в группе модуля; остальное — Прочее', () => {
    expect(groupOf({ from: 'server/lib/graph.ts' })).toBe('server/lib');
    expect(groupOf({ from: 'какая-то-функция' })).toBe(OTHER_GROUP);

    const logical = [{ id: 'graph-core', path: 'server/lib/graph.ts' }];
    const pathModel = buildGroups(logical, []);
    // Поток назвал файл, а модуль назван логически — находится по path.
    expect(flowGroupResolver(pathModel, logical)({ from: 'server/lib/graph.ts' })).toBe('server/lib');
  });
});

describe('scopeDataflow', () => {
  it('группа кода: её потоки и источники, на которые они идут', () => {
    const scoped = scopeDataflow(data, { group: 'server/api' }, groupOf);
    expect(scoped.flows.map((item) => item.to).sort()).toEqual(['ai', 'pg']);
    expect(scoped.sources.map((source) => source.id).sort()).toEqual(['ai', 'pg']);
  });

  it('свёртка источников: её источники и все потоки к ним', () => {
    const scoped = scopeDataflow(data, { bucket: 'база данных' }, groupOf);
    expect(scoped.sources.map((source) => source.id).sort()).toEqual(['cache', 'pg']);
    expect(scoped.flows).toHaveLength(3);
  });

  it('без среза — всё как есть', () => {
    expect(scopeDataflow(data, {}, groupOf)).toBe(data);
  });
});

describe('dataflowOverviewMermaid', () => {
  const context = { titleOf: (id: string) => id, cardOf: () => undefined };
  const view = dataflowOverviewMermaid(data, groupOf, context);

  it('узлы — группы кода с числом потоков и свёртки источников с числом источников', () => {
    expect(view.text).toContain('g_server_lib["server/lib<br/>2 потока"]:::grp');
    expect(view.text).toContain('g_server_api["server/api<br/>2 потока"]:::grp');
    expect(view.text).toContain('g_Прочее["Прочее<br/>1 поток"]:::grp');
    expect(view.text).toContain('b_база_данных[("база данных<br/>2 источника")]:::bucket');
    expect(view.text).toContain('b_внешние_сервисы["внешние сервисы<br/>1 источник"]:::bucket');
  });

  it('хранилища — цилиндром, внешние системы — прямоугольником', () => {
    expect(view.text).toMatch(/b_файл\[\("файл<br\/>1 источник"\)\]/);
    expect(view.text).not.toMatch(/b_внешние_сервисы\[\(/);
  });

  it('чтение идёт от свёртки к группе, запись — от группы к свёртке, «оба» — жирная стрелка', () => {
    expect(view.text).toContain('b_база_данных -->|читает · 1| g_server_lib');
    expect(view.text).toContain('g_server_api -.->|пишет · 1| b_внешние_сервисы');
    expect(view.text).toContain('g_server_lib ==>|читает и пишет · 1| b_база_данных');
  });

  it('раскрытие стрелки — исходные потоки со свидетельствами; вердикт худший из свёрнутых', () => {
    const read = view.edges.find((edge) => edge.groupLink?.fromGroup === 'база данных' && edge.groupLink.toGroup === 'server/api');
    expect(read?.groupLink).toMatchObject({ unit: 'flows', summary: 'читает', status: 'stale', count: 1 });
    expect(read?.groupLink?.imports[0]?.evidence.path).toBe('x.ts');
    expect(view.text).toContain('linkStyle');
  });

  it('карточка свёртки несёт источники и число потоков', () => {
    const card = view.nodes['b_база_данных']?.bucket;
    expect(card?.flows).toBe(3);
    expect(card?.sources.map((source) => source.id).sort()).toEqual(['cache', 'pg']);
  });

  it('пустые потоки и источники — пустой вывод', () => {
    expect(dataflowOverviewMermaid({ sources: [], flows: [] }, groupOf, context).text).toBe('');
  });
});
