import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';

import { canDeleteMap, engineMaps } from '../server/lib/custom-maps';
import { removeCustomMap } from '../server/lib/manifest-write';
import { emptyProjectMap } from '../server/lib/maps';

/** Удаление рабочей карты (ADR-0036). */

const MANIFEST = [
  'name: p',
  'maps:',
  '  # свои карты',
  '  custom:',
  '    - {"id":"codemap","title":"Кодовая база","template":"codemap","by":"anna"}',
  '    - id: risks',
  '      title: Риски',
  '      node: { label: Риск, plural: Риски }',
  '    - {"id":"dataflow","title":"Потоки данных","template":"dataflow"}',
  'policy:',
  '  x: 1',
  ''
].join('\n');

describe('кто может удалить', () => {
  it('создатель и администратор; строку без by — только администратор', () => {
    const own = { id: 'codemap', by: 'anna' };
    expect(canDeleteMap(own, 'anna', false)).toBe(true);
    expect(canDeleteMap(own, 'boris', false)).toBe(false);
    expect(canDeleteMap(own, 'boris', true)).toBe(true);
    expect(canDeleteMap({ id: 'x' }, 'anna', false)).toBe(false);
    expect(canDeleteMap({ id: 'x' }, 'anna', true)).toBe(true);
  });
});

describe('строка убирается точечно', () => {
  it('многострочный элемент из середины; комментарии и соседние секции целы', () => {
    const edit = removeCustomMap(MANIFEST, 1);
    expect(edit.ok).toBe(true);
    if (!edit.ok) return;
    const after = load(edit.text) as { maps: { custom: { id: string }[] }; policy: { x: number } };
    expect(after.maps.custom.map((item) => item.id)).toEqual(['codemap', 'dataflow']);
    expect(after.policy.x).toBe(1);
    expect(edit.text).toContain('# свои карты');
  });

  it('последний элемент — остаётся custom: []', () => {
    const one = ['maps:', '  custom:', '    - {"id":"codemap","template":"codemap"}', ''].join('\n');
    const edit = removeCustomMap(one, 0);
    expect(edit.ok && (load(edit.text) as { maps: { custom: unknown[] } }).maps.custom).toEqual([]);
  });
});

describe('удалённая карта с движком не возвращается сама', () => {
  it('объявлена хоть одна — живые записи без строки не показываются', () => {
    const map = emptyProjectMap();
    map.codemap.modules.push({ id: 'a' } as never);
    map.userflow.screens.push({ id: 's' } as never);
    expect(engineMaps({ maps: { custom: [{ id: 'dataflow', template: 'dataflow' }] } }, map)).toEqual(['dataflow']);
    expect(engineMaps({ maps: { custom: [] } }, map)).toEqual([]);
    expect(engineMaps({}, map)).toEqual(['codemap', 'userflow']);
  });
});
