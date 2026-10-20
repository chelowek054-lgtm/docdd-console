import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';

import { customDefinitions, customDraftText, customMapView, defaultCustomRelations } from '../server/lib/custom-maps';
import { appendCustomMap } from '../server/lib/manifest-write';
import { foldMaps, parseMapRecord, type MapChange } from '../server/lib/maps';

/** Пользовательские карты по ADR-0028 (R-0042): разбор, ключи, сложение, определения. */

const LF = String.fromCharCode(10);

function body(json: unknown): string {
  return ['# Карта', '', '```docdd-custom', JSON.stringify(json, null, 2), '```', ''].join(LF);
}

const def = (extra: Record<string, unknown> = {}) => ({
  id: 'godot-client', title: 'Клиент Godot', node: { label: 'Подсистема', plural: 'Подсистемы' }, ...extra
});

describe('parseMapRecord: docdd-custom', () => {
  it('разбирает блок и проставляет map блока каждому узлу и связи', () => {
    const parsed = parseMapRecord(body({
      map: 'godot-client',
      added: {
        nodes: [{ id: 'anim', title: 'Анимации' }],
        relations: [{ from: 'anim', to: 'visual', type: 'depends' }]
      }
    }));
    expect(parsed.problems).toEqual([]);
    expect(parsed.present).toEqual(['custom']);
    expect(parsed.change.custom?.added?.nodes?.[0]?.map).toBe('godot-client');
    expect(parsed.change.custom?.added?.relations?.[0]?.map).toBe('godot-client');
  });

  it('своя map у элемента важнее map блока', () => {
    const parsed = parseMapRecord(body({ map: 'a', added: { nodes: [{ id: 'x', map: 'b' }] } }));
    expect(parsed.change.custom?.added?.nodes?.[0]?.map).toBe('b');
  });

  it('отвергает блок, где у узла нет карты ни своей, ни блока', () => {
    const parsed = parseMapRecord(body({ added: { nodes: [{ id: 'x' }] } }));
    expect(parsed.problems.length).toBeGreaterThan(0);
    expect(parsed.change.custom).toBeUndefined();
  });

  it('отвергает неверный id карты и не JSON', () => {
    expect(parseMapRecord(body({ map: 'плохо id', added: { nodes: [{ id: 'x' }] } })).problems.length).toBeGreaterThan(0);
    const broken = ['```docdd-custom', '{нет', '```'].join(LF);
    expect(parseMapRecord(broken).problems[0]?.message).toContain('JSON');
  });
});

describe('foldMaps: custom', () => {
  const change = (c: unknown): MapChange => parseMapRecord(body(c)).change;

  it('одинаковые id узлов в разных картах не путаются (ключ map:id)', () => {
    const folded = foldMaps([
      { id: 'M-1', change: change({ map: 'a', added: { nodes: [{ id: 'x', title: 'A-x' }] } }) },
      { id: 'M-2', change: change({ map: 'b', added: { nodes: [{ id: 'x', title: 'B-x' }] } }) }
    ]);
    expect(folded.custom.nodes.map((n) => `${n.map}:${n.title}`)).toEqual(['a:A-x', 'b:B-x']);
  });

  it('одна запись несёт несколько карт', () => {
    const folded = foldMaps([{
      id: 'M-1',
      change: change({ added: { nodes: [{ map: 'a', id: 'x' }, { map: 'b', id: 'x' }] } })
    }]);
    expect(folded.custom.nodes).toHaveLength(2);
    expect(folded.custom.nodes.every((n) => n.declaredBy === 'M-1')).toBe(true);
  });

  it('повторное объявление уточняет, removed убирает; связи ключуются map:from>to:type', () => {
    const folded = foldMaps([
      { id: 'M-1', change: change({ map: 'a', added: { nodes: [{ id: 'x', title: 'Старое' }, { id: 'y' }], relations: [{ from: 'x', to: 'y', type: 'depends' }, { from: 'x', to: 'y', type: 'uses' }] } }) },
      { id: 'M-2', change: change({ map: 'a', added: { nodes: [{ id: 'x', title: 'Новое' }] }, removed: { relations: [{ from: 'x', to: 'y', type: 'depends' }], nodes: [{ id: 'y' }] } }) }
    ]);
    expect(folded.custom.nodes).toHaveLength(1);
    expect(folded.custom.nodes[0]?.title).toBe('Новое');
    expect(folded.custom.nodes[0]?.declaredBy).toBe('M-2');
    expect(folded.custom.relations.map((r) => r.type)).toEqual(['uses']);
  });

  it('пустая картина без custom-блоков', () => {
    expect(foldMaps([]).custom).toEqual({ nodes: [], relations: [] });
  });
});

describe('customDefinitions', () => {
  it('нет секции — нет определений и бед', () => {
    expect(customDefinitions({})).toEqual({ definitions: [], problems: [] });
  });

  it('годное определение: виды связей по умолчанию — пять функциональных, features пусты', () => {
    const { definitions, problems } = customDefinitions({ maps: { custom: [def()] } } as never);
    expect(problems).toEqual([]);
    expect(definitions[0]?.relations).toEqual(defaultCustomRelations());
    expect(definitions[0]?.relations).toHaveLength(5);
    expect(definitions[0]?.features).toEqual([]);
  });

  it('сохраняет незнакомые поля определения', () => {
    const { definitions } = customDefinitions({ maps: { custom: [def({ own: { x: 1 } })] } } as never);
    expect((definitions[0] as unknown as { own: unknown }).own).toEqual({ x: 1 });
  });

  it('свои виды связей и features без повторов', () => {
    const { definitions, problems } = customDefinitions({
      maps: { custom: [def({ relations: [{ id: 'uses', label: 'пользуется', style: 'uses' }], features: ['status', 'status', 'links'] })] }
    } as never);
    expect(problems).toEqual([]);
    expect(definitions[0]?.relations).toHaveLength(1);
    expect(definitions[0]?.features).toEqual(['status', 'links']);
  });

  it('ошибки одной карты не гасят остальные', () => {
    const { definitions, problems } = customDefinitions({
      maps: { custom: [
        def({ id: 'плохо' }),
        def({ id: 'ok' }),
        def({ id: 'ok' }),
        def({ id: 'n', title: ' ' }),
        def({ id: 'f', features: ['magic'] }),
        def({ id: 'r', relations: [{ id: 'a', label: 'b', style: 'nope' }] }),
        def({ id: 'd', relations: [{ id: 'a', label: 'b', style: 'uses' }, { id: 'a', label: 'c', style: 'uses' }] }),
        def({ id: 'nn', node: { label: 'x' } }),
        'строка'
      ] }
    } as never);
    expect(definitions.map((d) => d.id)).toEqual(['ok']);
    expect(problems).toHaveLength(8);
    expect(problems.join(' ')).toContain('уже объявлена');
  });

  it('maps.custom не список — беда проекта, не падение', () => {
    const { definitions, problems } = customDefinitions({ maps: { custom: 'x' } } as never);
    expect(definitions).toEqual([]);
    expect(problems).toHaveLength(1);
  });
});

describe('customMapView', () => {
  const folded = foldMaps([{
    id: 'M-1',
    change: parseMapRecord(body({
      map: 'a',
      added: {
        nodes: [{ id: 'x', status: 'partial', priority: 'must', horizon: 'now', links: { modules: ['m.ts'] } }],
        relations: [{ from: 'x', to: 'x2', type: 'depends', evidence: { path: 'm.ts', line: 1, fragment: 'import x' } }]
      }
    })).change
  }, { id: 'M-2', change: parseMapRecord(body({ map: 'other', added: { nodes: [{ id: 'z' }] } })).change }]);
  const [definition] = customDefinitions({ maps: { custom: [def({ id: 'a' })] } } as never).definitions;

  it('берёт только узлы своей карты и скрывает невключённые features', () => {
    const view = customMapView(folded, definition!);
    expect(view.nodes.map((n) => n.id)).toEqual(['x']);
    expect(view.nodes[0]).toMatchObject({ status: undefined, priority: undefined, horizon: undefined, links: undefined });
    expect(view.relations[0]?.evidence).toBeUndefined();
  });

  it('включённые features показываются', () => {
    const full = { ...definition!, features: ['status', 'priority', 'horizon', 'links', 'evidence'] as never };
    const view = customMapView(folded, full);
    expect(view.nodes[0]).toMatchObject({ status: 'partial', priority: 'must', horizon: 'now', links: { modules: ['m.ts'] } });
    expect(view.relations[0]?.evidence).toBeDefined();
  });
});

describe('customDraftText', () => {
  it('черновик читается обратно разбором записи', () => {
    const text = customDraftText('M-9', 'Карта', { map: 'a', added: { nodes: [{ map: 'a', id: 'x' }] } }, '2026-10-20');
    expect(text).toContain('status: draft');
    const parsed = parseMapRecord(text);
    expect(parsed.problems).toEqual([]);
    expect(parsed.change.custom?.added?.nodes?.[0]?.id).toBe('x');
  });
});

describe('appendCustomMap (временный файл)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'custom-map-'));
  const file = join(dir, 'project.yaml');
  const apply = (text: string, definition: Record<string, unknown>) => {
    writeFileSync(file, text, 'utf8');
    const edit = appendCustomMap(readFileSync(file, 'utf8'), definition);
    if (!edit.ok) throw new Error(edit.message);
    writeFileSync(file, edit.text, 'utf8');
    return load(readFileSync(file, 'utf8')) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  };

  it('без секции maps — добавляет её; остальное байт в байт', () => {
    const before = ['name: demo', '# комментарий', 'roles:', '  - id: architect', ''].join(LF);
    const out = apply(before, def());
    expect(out).toMatchObject({ name: 'demo', maps: { custom: [{ id: 'godot-client' }] } });
    expect(readFileSync(file, 'utf8').startsWith(before)).toBe(true);
  });

  it('дописывает вторую карту в конец списка, сохраняя чужие поля и следующие секции', () => {
    const first = ['maps:', '  custom:', '    - {"id":"a","title":"A","node":{"label":"x","plural":"xs"}}', '  other: 1', 'roles: []', ''].join(LF);
    const out = apply(first, def());
    expect(out['maps'].custom.map((c: { id: string }) => c.id)).toEqual(['a', 'godot-client']);
    expect(out['maps'].other).toBe(1);
    expect(out['roles']).toEqual([]);
  });

  it('custom: [] заменяется блоком; CRLF сохраняется', () => {
    const out = apply(['maps:', '  custom: []', ''].join('\r\n'), def());
    expect(out['maps'].custom).toHaveLength(1);
    expect(readFileSync(file, 'utf8')).toContain('\r\n');
  });

  it('форма не блоком — отказ без правки', () => {
    expect(appendCustomMap('maps: {custom: []}\n', def()).ok).toBe(false);
    expect(appendCustomMap('maps:\n  custom: [a]\n', def()).ok).toBe(false);
  });

  it('результат проходит customDefinitions', () => {
    const out = apply('name: x\n', def({ features: ['status'] }));
    expect(customDefinitions(out as never).definitions[0]?.features).toEqual(['status']);
    rmSync(dir, { recursive: true, force: true });
  });
});
