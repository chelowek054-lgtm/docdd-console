// V-0073
import { describe, expect, it } from 'vitest';

import { contrastRatio, plainTokens, resolveDesign, type DesignRecord } from '../server/lib/design';
import { contrastDiff, designDiff, paletteDiff, stackDiff } from '../server/lib/design-diff';

/** R-0073: разница токенов дизайна — палитра «было / станет», контраст до и после, файлы выгрузки по стекам. */

const block = (value: unknown): DesignRecord => ({ id: 'D-1', body: '```docdd-design\n' + JSON.stringify(value) + '\n```' });
const tokens = (light: Record<string, string>, dark: Record<string, string> = { ink: '#ffffff', bg: '#000000' }, extra: Record<string, unknown> = {}) =>
  plainTokens(resolveDesign({ general: [block({ unit: 'rem', palette: { light, dark }, ...extra })], local: [] }).tokens);

const WAS = tokens({ ink: '#111111', bg: '#ffffff', accent: '#0a5bd8', onAccent: '#ffffff' });
// ink посветлел до серого на белом (контраст упал ниже 4.5), accent изменён, добавлен warn, убран onAccent
const NOW = tokens({ ink: '#bbbbbb', bg: '#ffffff', accent: '#00557f', warn: '#aa5500' });

describe('палитра «было / станет»', () => {
  const light = paletteDiff(WAS, NOW).find((item) => item.theme === 'light');
  const row = (role: string) => light?.rows.find((item) => item.role === role);

  it('роль за ролью: changed, added, removed, same', () => {
    expect(row('ink')).toMatchObject({ before: '#111111', after: '#BBBBBB', state: 'changed' });
    expect(row('warn')).toMatchObject({ before: null, after: '#AA5500', state: 'added' });
    expect(row('onAccent')).toMatchObject({ before: '#FFFFFF', after: null, state: 'removed' });
    expect(row('bg')?.state).toBe('same');
  });
  it('тема без изменений не приходит', () => {
    expect(paletteDiff(WAS, NOW).map((item) => item.theme)).toEqual(['light']);
    expect(paletteDiff(WAS, WAS)).toEqual([]);
  });
  it('добавленная тема появляется отдельной палитрой', () => {
    const themed = tokens({ ink: '#111111', bg: '#ffffff' }, undefined, { themes: { ocean: { mode: 'light', palette: { accent: '#00557f' } } } });
    const base = tokens({ ink: '#111111', bg: '#ffffff' });
    expect(paletteDiff(base, themed).map((item) => item.theme)).toEqual(['ocean']);
  });
});

describe('контраст до и после', () => {
  it('значения совпадают с формулой WCAG и помечена регрессия ниже порога', () => {
    const rows = contrastDiff(WAS, NOW);
    const inkBg = rows.find((item) => item.theme === 'light' && item.pair.join('/') === 'ink/bg');
    expect(inkBg?.before).toBeCloseTo(contrastRatio('#111111', '#ffffff'), 1);
    expect(inkBg?.after).toBeCloseTo(contrastRatio('#bbbbbb', '#ffffff'), 1);
    expect(inkBg).toMatchObject({ okBefore: true, okAfter: false, regressed: true, min: 4.5 });
  });
  it('улучшение — не регрессия', () => {
    const rows = contrastDiff(NOW, WAS);
    const inkBg = rows.find((item) => item.pair.join('/') === 'ink/bg');
    expect(inkBg).toMatchObject({ okBefore: false, okAfter: true, regressed: false });
  });
  it('пара, которой не было или не стало, — с пустой стороной', () => {
    const rows = contrastDiff(WAS, NOW);
    const onAccent = rows.find((item) => item.pair.join('/') === 'onAccent/accent');
    expect(onAccent?.after).toBeNull();
  });
  it('без изменений — пусто', () => {
    expect(contrastDiff(WAS, WAS)).toEqual([]);
  });
});

describe('файлы выгрузки по стекам', () => {
  const stacks = [{ id: 'nuxt-ui' as const }, { id: 'expo' as const }];
  it('поменявшаяся палитра меняет файлы каждого стека; в diff видно новое значение', () => {
    const out = stackDiff(WAS, NOW, stacks);
    expect(out.map((item) => item.id)).toEqual(['nuxt-ui', 'expo']);
    for (const stack of out) {
      expect(stack.files.length).toBeGreaterThan(0);
      expect(stack.files.every((file) => file.state === 'changed' || file.state === 'added')).toBe(true);
    }
    expect(out[0]?.files.some((file) => file.diff.toLowerCase().includes('00557f'))).toBe(true);
  });
  it('токены не менялись — файлов нет; стеков в манифесте нет — пусто', () => {
    expect(stackDiff(WAS, WAS, stacks)).toEqual([]);
    expect(stackDiff(WAS, NOW, [])).toEqual([]);
  });
  it('общий designDiff собирает три части', () => {
    const all = designDiff(WAS, NOW, stacks);
    expect(all.palette.length).toBe(1);
    expect(all.contrast.length).toBeGreaterThan(0);
    expect(all.stacks.length).toBe(2);
  });
});
