// Провал в группу: внешние узлы по краю и подписанные связи (R-0145, V-0155).
import { describe, expect, it } from 'vitest';

import { codemapMermaid } from '../app/utils/map-mermaid';
import { groupBoundary, groupModules, importLabel } from '../server/lib/groups';
import { emptyProjectMap } from '../server/lib/maps';

const ev = (path: string, fragment: string) => ({ path, line: 1, fragment });
const modules = [
  { id: 'a1', title: 'A1', path: 'src/a/a1.ts' }, { id: 'a2', title: 'A2', path: 'src/a/a2.ts' },
  { id: 'b1', title: 'B1', path: 'src/b/b1.ts' }, { id: 'b2', title: 'B2', path: 'src/b/b2.ts' },
  { id: 'c1', title: 'C1', path: 'src/c/c1.ts' }
];
const imports = [
  { from: 'b1', to: 'a1', evidence: ev('src/b/b1.ts', "import { parseRecord, type Record } from '../a/a1';") },
  { from: 'b2', to: 'b1', evidence: ev('src/b/b2.ts', "import { x } from './b1';") },
  { from: 'c1', to: 'b2', evidence: ev('src/c/c1.ts', "import Cache from '../b/b2';") }
];
const groups = [
  { id: 'a', title: 'Группа A', paths: ['src/a/'] },
  { id: 'b', title: 'Группа B', paths: ['src/b/'] },
  { id: 'c', title: 'Группа C', paths: ['src/c/'] }
];

describe('граница группы (V-0155)', () => {
  const grouping = groupModules(modules, imports, groups);

  it('средняя группа: внешние узлы обеих соседних групп и только связи через границу', () => {
    const boundary = groupBoundary(grouping, 'b', modules, imports);
    expect(boundary.ghosts.map((ghost) => `${ghost.id}:${ghost.groupTitle}`).sort()).toEqual(['a1:Группа A', 'c1:Группа C']);
    expect(boundary.imports.map((item) => `${item.from}>${item.to}`)).toEqual(['b1>a1', 'c1>b2']);
  });

  it('на диаграмме связи с внешними узлами подписаны тем, что приходит', () => {
    const boundary = groupBoundary(grouping, 'b', modules, imports);
    const map = { ...emptyProjectMap(), codemap: { modules: modules.filter((item) => item.id.startsWith('b')), imports: [imports[1]!], groups } };
    const view = codemapMermaid(map as never, { ghosts: boundary.ghosts, ghostImports: boundary.imports });
    expect(view.text).toContain('-->|"parseRecord, Record"|');
    expect(view.text).toContain('-->|"Cache"|');
    expect(Object.values(view.nodes).filter((node) => node.ghost).length).toBe(2);
  });

  it('имена импорта: фигурные скобки, as, звёздочка, python, require; не разобрать — null', () => {
    expect(importLabel("import { a, b as c, type D } from './x'")).toBe('a, b, D');
    expect(importLabel("import * as path from 'node:path'")).toBe('path');
    expect(importLabel('from app.models import User, Order')).toBe('User, Order');
    expect(importLabel("const { readFile } = require('fs')")).toBe('readFile');
    expect(importLabel("import './side-effect'")).toBeNull();
    expect(importLabel('import { alpha, beta, gamma, delta, epsilon, zeta } from "./x"', 20)).toBe('alpha, beta, gamma +3');
  });
});
