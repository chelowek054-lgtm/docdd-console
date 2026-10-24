import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';

import { customDefinitions, declaredEngines, engineMaps } from '../server/lib/custom-maps';
import { appendCustomMap } from '../server/lib/manifest-write';
import { emptyProjectMap } from '../server/lib/maps';
import { NAV_ROLES, navVisible } from '../app/utils/nav-roles';

/** Две категории карт (ADR-0035): стратегическая и рабочие, у части рабочих — шаблон с движком. */

const custom = (...entries: unknown[]) => ({ maps: { custom: entries } });

describe('шаблоны с движком в манифесте', () => {
  it('строка с template не пользовательская карта: определений нет, бед нет', () => {
    const manifest = custom({ id: 'codemap', title: 'Кодовая база', template: 'codemap' });
    expect(customDefinitions(manifest)).toEqual({ definitions: [], problems: [] });
    expect(declaredEngines(manifest)).toEqual(['codemap']);
  });

  it('чужой шаблон или id не по шаблону — беда этой строки, остальные живут', () => {
    const manifest = custom(
      { id: 'backend', title: 'Бэкенд', template: 'codemap' },
      { id: 'dataflow', title: 'Потоки', template: 'dataflow' },
      { id: 'x', title: 'Х', node: { label: 'Узел', plural: 'Узлы' } }
    );
    const result = customDefinitions(manifest);
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toContain('maps.custom[0].template');
    expect(result.definitions.map((item) => item.id)).toEqual(['x']);
    expect(declaredEngines(manifest)).toEqual(['dataflow']);
  });

  it('свой id «codemap» или «functional» занят', () => {
    const result = customDefinitions(custom(
      { id: 'codemap', title: 'Кодовая база', template: 'codemap' },
      { id: 'codemap', title: 'Ещё', node: { label: 'Узел', plural: 'Узлы' } }
    ));
    expect(result.definitions).toEqual([]);
    expect(result.problems.join(' ')).toContain('занято');
  });
});

describe('какие рабочие карты с движком есть у проекта', () => {
  it('новый проект — никаких', () => {
    expect(engineMaps({}, emptyProjectMap())).toEqual([]);
  });

  it('старый проект: подтверждённые записи делают карту видимой без правки манифеста', () => {
    const map = emptyProjectMap();
    map.dataflow.sources.push({ id: 'db', title: 'База', kind: 'database' } as never);
    expect(engineMaps({}, map)).toEqual(['dataflow']);
  });

  it('есть список maps.custom — он и решает, живые записи без строки не видны (ADR-0036)', () => {
    const map = emptyProjectMap();
    map.userflow.screens.push({ id: 'home', title: 'Главная' } as never);
    expect(engineMaps(custom({ id: 'codemap', title: 'К', template: 'codemap' }), map)).toEqual(['codemap']);
  });
});

describe('«Стратегия» видна всем ролям', () => {
  it('в шапке у любой роли', () => {
    for (const role of NAV_ROLES) expect(navVisible('strategy', role), role).toBe(true);
  });
});

describe('шаблон с движком в project.yaml', () => {
  it('точечно дописывается в maps.custom и читается как объявленный', () => {
    const edit = appendCustomMap(['name: p', 'maps:', '  custom: []', ''].join('\n'), { id: 'codemap', title: 'Кодовая база', template: 'codemap' });
    expect(edit.ok).toBe(true);
    if (!edit.ok) return;
    const manifest = load(edit.text) as { maps: { custom: unknown[] } };
    expect(declaredEngines(manifest)).toEqual(['codemap']);
    expect(customDefinitions(manifest).problems).toEqual([]);
  });
});
