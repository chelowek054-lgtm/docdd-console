import { describe, expect, it } from 'vitest';

import { codemapMermaid, groupOverviewMermaid, violationKey } from '../app/utils/map-mermaid';
import { groupModules } from '../server/lib/groups';
import { emptyProjectMap, type ProjectMap } from '../server/lib/maps';

/** Нарушения архитектуры на карте кода (docs/04-ui.md, «Архитектура на карте кода»). */

const ev = { path: 'app/main.py', line: 1, fragment: 'from app.knowledge.engine import run' };

const map: ProjectMap = {
  ...emptyProjectMap(),
  codemap: {
    modules: [{ id: 'app/main.py' }, { id: 'app/knowledge/engine.py' }, { id: 'app/billing/__init__.py' }],
    imports: [
      { from: 'app/main.py', to: 'app/knowledge/engine.py', evidence: ev, status: 'ok' },
      { from: 'app/main.py', to: 'app/billing/__init__.py', evidence: ev, status: 'ok' }
    ],
    groups: []
  }
};

const violations = new Map([
  [violationKey('app/main.py', 'app/knowledge/engine.py'), { code: 'arch_entry_bypassed', message: 'в обход входа' }]
]);

describe('кодовая карта с нарушениями', () => {
  it('нарушение — фиолетовая толстая стрелка и правило на ребре', () => {
    const out = codemapMermaid(map, { violations });
    expect(out.text).toContain('linkStyle 0 stroke:#7C3AED,stroke-width:4px;');
    expect(out.text).not.toContain('linkStyle 1');
    expect(out.edges[0]?.arch?.code).toBe('arch_entry_bypassed');
    expect(out.edges[1]?.arch).toBeUndefined();
  });

  it('легенда считает нарушения отдельной строкой', () => {
    const items = codemapMermaid(map, { violations }).mapLegend ?? [];
    const row = items.find((item) => item.label === 'нарушение архитектуры');
    expect(row?.count).toBe(1);
    expect(items.find((item) => item.label.startsWith('импорт:'))?.count).toBe(1);
  });

  it('без нарушений строки в легенде нет', () => {
    const items = codemapMermaid(map).mapLegend ?? [];
    expect(items.some((item) => item.label === 'нарушение архитектуры')).toBe(false);
  });

  it('красное «свидетельство не сошлось» важнее фиолетового', () => {
    const stale: ProjectMap = {
      ...map,
      codemap: { ...map.codemap, imports: [{ ...map.codemap.imports[0]!, status: 'stale' }] }
    };
    const out = codemapMermaid(stale, { violations });
    expect(out.text).toContain('stroke:#DC2626');
    expect(out.text).not.toContain('#7C3AED');
  });
});

describe('обзор групп с нарушениями', () => {
  it('стрелка между группами фиолетовая, если нарушает хоть один импорт', () => {
    const grouping = groupModules(map.codemap.modules, map.codemap.imports);
    const out = groupOverviewMermaid(grouping, violations);
    expect(out.text).toContain('#7C3AED');
    expect(out.edges.some((edge) => edge.link?.archCount === 1)).toBe(true);
    expect((out.mapLegend ?? []).some((item) => item.label === 'нарушение архитектуры')).toBe(true);
  });
});
