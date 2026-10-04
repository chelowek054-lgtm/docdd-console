import { describe, expect, it } from 'vitest';

import {
  codemapMermaid,
  dataflowMermaid,
  groupOverviewMermaid,
  userflowMermaid,
  type MapLegendItem
} from '../app/utils/map-mermaid';
import { groupModules } from '../server/lib/groups';
import { emptyProjectMap, type ProjectMap } from '../server/lib/maps';

/** Легенда кодовой базы, потоков и путей (docs/04-ui.md, «Легенда кодовой базы, потоков и путей»). */

const ev = (fragment = 'x') => ({ path: 'x.ts', line: 1, fragment });
const text = (items: MapLegendItem[] | undefined) => (items ?? []).map((item) => `${item.label}${item.count ? ` · ${item.count}` : ''}`);

function withMap(patch: Partial<ProjectMap>): ProjectMap {
  return { ...emptyProjectMap(), ...patch };
}

describe('кодовая база — модули', () => {
  const map = withMap({
    codemap: {
      modules: [
        { id: 'a.ts', layer: 'ядро' }, { id: 'b.ts', layer: 'ядро', pending: true }, { id: 'c.ts', layer: 'экраны' }
      ],
      imports: [
        { from: 'a.ts', to: 'b.ts', evidence: ev(), status: 'ok' },
        { from: 'c.ts', to: 'a.ts', evidence: ev(), status: 'stale' }
      ],
      groups: []
    }
  });

  it('слои с числом модулей, импорты, красная и полупрозрачность — только то, что нарисовано', () => {
    const items = text(codemapMermaid(map).mapLegend);
    expect(items).toContain('слой «ядро» · 2');
    expect(items).toContain('слой «экраны» · 1');
    expect(items).toContain('импорт: кто → кого · 1');
    expect(items).toContain('свидетельство не сошлось с файлом · 1');
    expect(items.some((item) => item.startsWith('полупрозрачный'))).toBe(true);
    expect(items.some((item) => item.startsWith('толстая рамка'))).toBe(false);
    expect(items.some((item) => item.includes('сосед'))).toBe(false);
  });

  it('порт и сосед из другой группы появляются, когда нарисованы', () => {
    const items = text(codemapMermaid(map, {
      ports: new Set(['a.ts']),
      ghosts: [{ id: 'z.ts', groupId: 'g', groupTitle: 'Г', title: 'Z' }]
    } as never).mapLegend);
    expect(items.some((item) => item.startsWith('толстая рамка — порт') && item.endsWith('· 1'))).toBe(true);
    expect(items.some((item) => item.startsWith('пунктир — сосед') && item.endsWith('· 1'))).toBe(true);
  });

  it('больше восьми слоёв — восемь поимённо и «…и ещё N»', () => {
    const modules = Array.from({ length: 11 }, (_, at) => ({ id: `m${at}.ts`, layer: `слой${at}` }));
    const items = text(codemapMermaid(withMap({ codemap: { modules, imports: [], groups: [] } })).mapLegend);
    expect(items.filter((item) => item.startsWith('слой «'))).toHaveLength(8);
    expect(items).toContain('…и ещё 3 слоёв · 3');
  });

  it('пустая карта — легенды нет', () => {
    expect(codemapMermaid(emptyProjectMap()).mapLegend).toBeUndefined();
  });
});

describe('кодовая база — обзор групп', () => {
  it('группы, «авто», число импортов; цикл оранжевой, красная — когда не сошлось', () => {
    const modules = [{ id: 'app/a.ts' }, { id: 'srv/b.ts' }];
    const imports = [
      { from: 'app/a.ts', to: 'srv/b.ts', evidence: ev(), status: 'ok' as const },
      { from: 'srv/b.ts', to: 'app/a.ts', evidence: ev(), status: 'ok' as const }
    ];
    const items = text(groupOverviewMermaid(groupModules(modules, imports, [])).mapLegend);
    expect(items.some((item) => item.startsWith('группа;') && item.endsWith('· 2'))).toBe(true);
    expect(items.some((item) => item.startsWith('«авто»') && item.endsWith('· 2'))).toBe(true);
    expect(items.some((item) => item.startsWith('число на стрелке') && item.endsWith('· 2'))).toBe(true);
    expect(items.some((item) => item.startsWith('группы зависят друг от друга по кругу') && item.endsWith('· 2'))).toBe(true);
    expect(items.some((item) => item.startsWith('свидетельство'))).toBe(false);
  });
});

describe('потоки данных', () => {
  const map = withMap({
    dataflow: {
      sources: [{ id: 'db', kind: 'db' }, { id: 'q', kind: 'queue' }, { id: 'f', kind: 'file' }],
      flows: [
        { from: 'm1', to: 'db', direction: 'read', evidence: ev() },
        { from: 'm1', to: 'q', direction: 'write', evidence: ev() },
        { from: 'm2', to: 'db', direction: 'both', evidence: ev(), status: 'missing' }
      ]
    }
  });

  it('виды источников с формой, читатели, направления с числом, красная', () => {
    const legend = dataflowMermaid(map).mapLegend ?? [];
    const items = text(legend);
    expect(items).toContain('база данных · 1');
    expect(items).toContain('очередь · 1');
    expect(items).toContain('модуль или экран, что читает и пишет · 2');
    expect(items).toContain('чтение: данные идут от источника · 1');
    expect(items).toContain('запись: данные идут к источнику · 1');
    expect(items).toContain('и чтение, и запись · 1');
    expect(items).toContain('свидетельство не сошлось с файлом · 1');
    expect(legend.find((item) => item.label === 'база данных')?.shape).toBe('cylinder');
    expect(legend.find((item) => item.label === 'очередь')?.shape).toBe('box');
  });

  it('направления, которых нет на схеме, в легенду не идут', () => {
    const only = withMap({ dataflow: { sources: [{ id: 'db', kind: 'db' }], flows: [{ from: 'm', to: 'db', direction: 'read', evidence: ev() }] } });
    const items = text(dataflowMermaid(only).mapLegend);
    expect(items.some((item) => item.startsWith('запись'))).toBe(false);
    expect(items.some((item) => item.startsWith('и чтение'))).toBe(false);
  });
});

describe('пользовательские пути', () => {
  it('экраны, маршруты, виды переходов и вызовы', () => {
    const map = withMap({
      userflow: {
        screens: [{ id: '/a' }, { id: '/b', pending: true }],
        transitions: [
          { from: '/a', to: '/b', trigger: 'клик', evidence: ev() },
          { from: '/b', to: '/a', evidence: ev() }
        ],
        calls: [{ from: '/a', to: 'GET /api/x', evidence: ev() }, { from: '/b', to: 'GET /api/x', evidence: ev() }]
      }
    });
    const items = text(userflowMermaid(map).mapLegend);
    expect(items).toContain('экран · 2');
    expect(items).toContain('маршрут API · 1');
    expect(items).toContain('переход по действию; подпись — что его вызывает · 1');
    expect(items).toContain('пунктир к экрану — переход, чем он вызывается, карта не говорит · 1');
    expect(items).toContain('пунктир к маршруту — вызов API · 2');
    expect(items.some((item) => item.startsWith('полупрозрачный'))).toBe(true);
  });
});
