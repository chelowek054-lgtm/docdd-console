// V-0069
import { describe, expect, it } from 'vitest';

import { atLevel, changedInside, countsText, diffCounts, mapDiffForRecord, onlyChangedIds } from '../server/lib/map-diff';
import { rec } from './helpers';

/**
 * R-0069: разница карты на схеме. «Было» — подтверждённые карты до записи,
 * «станет» — вместе с ней; added/removed/changed, счётчик, сворачивание по глубине.
 */

const LF = String.fromCharCode(10);
const fence = (name: string, value: unknown) => ['```docdd-' + name, JSON.stringify(value), '```', ''].join(LF);
const map = (id: string, status: string, updated: string, body: string) => rec(id, 'map', status, { updated, body, extra: { updated } });

const cap = (id: string, extra: Record<string, unknown> = {}) => ({ id, title: `Возможность ${id}`, ...extra });

const base = map('M-0001', 'approved', '2026-10-01', fence('functional', {
  added: {
    capabilities: [cap('root'), cap('a', { parent: 'root' }), cap('b', { parent: 'root' }), cap('deep', { parent: 'a' }), cap('keep', { parent: 'b' })],
    relations: [{ from: 'a', to: 'b', type: 'depends' }, { from: 'keep', to: 'deep', type: 'uses' }]
  }
}));

// Новая карта: добавляет `fresh` под `a`, убирает `keep`, меняет название `deep`, добавляет и убирает связь.
const change = map('M-0002', 'review', '2026-10-02', fence('functional', {
  added: {
    capabilities: [cap('fresh', { parent: 'a' }), cap('deep', { parent: 'a', title: 'Новое название' })],
    relations: [{ from: 'fresh', to: 'b', type: 'depends' }]
  },
  removed: { capabilities: [{ id: 'keep' }], relations: [{ from: 'keep', to: 'deep', type: 'uses' }] }
}));

const diff = mapDiffForRecord([base, change], 'M-0002');
const functional = diff?.structures.find((item) => item.structure === 'functional');
const mark = (id: string) => functional?.nodes.find((node) => node.id === id)?.mark;

describe('added / removed / changed', () => {
  it('разбор тестовых карт без замечаний (иначе тест врёт)', async () => {
    const { parseMapRecord } = await import('../server/lib/maps');
    expect(parseMapRecord(change.body).problems).toEqual([]);
    expect(parseMapRecord(base.body).problems).toEqual([]);
  });
  it('узлы: добавленный, убранный, изменённый (с полем), нетронутые — same', () => {
    expect(mark('fresh')).toBe('added');
    expect(mark('keep')).toBe('removed');
    expect(mark('deep')).toBe('changed');
    expect(functional?.nodes.find((node) => node.id === 'deep')?.fields).toContain('title');
    expect(mark('root')).toBe('same');
    expect(mark('b')).toBe('same');
  });
  it('связи: добавленная и убранная', () => {
    const edges = functional?.edges.map((edge) => `${edge.mark}:${edge.from}>${edge.to}`).sort();
    expect(edges).toEqual(['added:fresh>b', 'removed:keep>deep', 'same:a>b'].sort());
  });
  it('структуры, которых запись не касалась, не приходят', () => {
    expect(diff?.structures.map((item) => item.structure)).toEqual(['functional']);
  });
  it('служебные следы (declaredBy, evidence) изменением не считаются', () => {
    const noisy = map('M-0003', 'review', '2026-10-03', fence('functional', { added: { capabilities: [cap('root', { declaredBy: 'x', evidence: [{ path: 'a' }] })] } }));
    expect(mapDiffForRecord([base, noisy], 'M-0003')?.structures).toEqual([]);
  });
  it('не-карта и неизвестная запись — null', () => {
    expect(mapDiffForRecord([base], 'T-1')).toBeNull();
    expect(mapDiffForRecord([base], 'M-7777')).toBeNull();
  });
  it('подтверждённая карта смотрится «на момент до себя»: следующие её не задевают', () => {
    const later = map('M-0009', 'approved', '2026-12-01', fence('functional', { added: { capabilities: [cap('zzz')] } }));
    const own = mapDiffForRecord([base, { ...change, status: 'approved' }, later], 'M-0002');
    expect(own?.structures[0]?.nodes.find((node) => node.id === 'zzz')).toBeUndefined();
    expect(own?.structures[0]?.nodes.find((node) => node.id === 'fresh')?.mark).toBe('added');
  });
});

describe('счётчик', () => {
  it('«+N, −N, ~N; связей …»', () => {
    const counts = diffCounts(functional!);
    expect(counts).toMatchObject({ added: 1, removed: 1, changed: 1, edgesAdded: 1, edgesRemoved: 1 });
    expect(countsText(counts)).toBe('+1, −1, ~1; связей +1 −1');
  });
  it('без связей — без хвоста', () => {
    expect(countsText({ added: 2, removed: 0, changed: 0, edgesAdded: 0, edgesRemoved: 0, edgesChanged: 0 })).toBe('+2, −0, ~0');
  });
});

describe('сворачивание по глубине и режим «только изменённое»', () => {
  it('число изменений внутри каждой группы на любой глубине', () => {
    const inside = changedInside(functional!);
    expect(inside.get('root')).toBe(3);
    expect(inside.get('a')).toBe(2); // fresh + deep
    expect(inside.get('b')).toBe(1); // keep
  });
  it('на уровне 1 узлы глубже сворачиваются в видимого предка, и он подсвечен', () => {
    const level = atLevel(functional!, 1);
    expect(level.nodes.map((node) => node.id).sort()).toEqual(['a', 'b', 'root']);
    const a = level.nodes.find((node) => node.id === 'a');
    expect(a).toMatchObject({ mark: 'changed', inside: 2 });
    expect(level.nodes.find((node) => node.id === 'root')?.inside).toBe(3);
  });
  it('на уровне 0 остаётся только корень, стрелок нет', () => {
    const level = atLevel(functional!, 0);
    expect(level.nodes.map((node) => node.id)).toEqual(['root']);
    expect(level.edges).toEqual([]);
  });
  it('свёрнутая стрелка из смешанных связей — changed, из однородных — их отметка', () => {
    const level = atLevel(functional!, 1);
    const arrow = (from: string, to: string) => level.edges.find((edge) => edge.from === from && edge.to === to);
    expect(arrow('a', 'b')).toMatchObject({ mark: 'changed', count: 2 }); // same a>b + added fresh>b
    expect(arrow('b', 'a')).toMatchObject({ mark: 'removed', count: 1 }); // keep>deep
  });
  it('«только изменённое с соседями»: изменённые, их предки и соседи по связям; остальное скрыто', () => {
    const keep = onlyChangedIds(functional!);
    for (const id of ['fresh', 'keep', 'deep', 'a', 'root', 'b']) expect(keep.has(id)).toBe(true);
    const wide = map('M-0004', 'review', '2026-10-04', fence('functional', { added: { capabilities: [cap('lonely', { parent: 'root' })] } }));
    const small = mapDiffForRecord([base, wide], 'M-0004')?.structures[0];
    const ids = onlyChangedIds(small!);
    expect(ids.has('lonely')).toBe(true);
    expect(ids.has('keep')).toBe(false);
  });
});

describe('кодовая база: группа модуля — поле модуля', () => {
  it('перенос модуля в другую группу — changed с полем group', () => {
    const was = map('M-0001', 'approved', '2026-10-01', fence('codemap', { added: { modules: [{ id: 'm1', path: 'a/m1.ts' }], groups: [{ id: 'g1', modules: ['m1'] }, { id: 'g2', modules: [] }] } }));
    const now = map('M-0002', 'review', '2026-10-02', fence('codemap', { added: { groups: [{ id: 'g1', modules: [] }, { id: 'g2', modules: ['m1'] }] } }));
    const codemap = mapDiffForRecord([was, now], 'M-0002')?.structures.find((item) => item.structure === 'codemap');
    expect(codemap?.nodes.find((node) => node.id === 'm1')).toMatchObject({ mark: 'changed', fields: ['group'] });
  });
});
