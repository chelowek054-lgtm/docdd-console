import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { contrastRatio, parseDesignBlocks, plainTokens, resolveDesign, type DesignRecord } from '../server/lib/design';

/**
 * V-0030: разбор блока `docdd-design`, сложение «общее → локальное», проверки токенов.
 * Тексты проверок — по требованиям R-0030/R-0031, а не по устройству кода.
 */

const block = (value: unknown): string => '```docdd-design\n' + JSON.stringify(value) + '\n```';
const rec = (id: string, value: unknown, label?: string): DesignRecord => ({ id, body: block(value), ...(label ? { label } : {}) });

const etalon: DesignRecord = {
  id: 'D-0001',
  label: 'practices',
  body: readFileSync(resolve(__dirname, '../practices/docs/development/design/D-0001-edinyy-dizayn-praxis-tokeny.md'), 'utf8')
};

describe('разбор блока', () => {
  it('ошибка формата называется и не роняет разбор', () => {
    const bad = parseDesignBlocks({ id: 'D-9', body: '```docdd-design\n{не json\n```' });
    expect(bad.blocks).toEqual([]);
    expect(bad.problems[0]?.record).toBe('D-9');
    const noUnit = parseDesignBlocks(rec('D-8', { spacing: { xs: 0.25 } }));
    expect(noUnit.problems.map((p) => p.message).join()).toContain('rem');
  });

  it('неизвестные поля сохраняются', () => {
    const r = resolveDesign({ general: [rec('D-1', { unit: 'rem', custom: { a: 1 } })], local: [] });
    expect(r.tokens.extra['custom']?.value).toEqual({ a: 1 });
    expect(r.tokens.extra['custom']?.source).toBeTruthy();
  });

  it('без блоков дизайна нет, проверять нечего', () => {
    const r = resolveDesign({ general: [], local: [] });
    expect(r.empty).toBe(true);
    expect(r.checks).toEqual([]);
  });
});

describe('сложение общее → локальное', () => {
  it('у каждой части есть источник и уровень', () => {
    const r = resolveDesign({
      general: [rec('G', { unit: 'rem', spacing: { xs: 0.25 } })],
      local: [rec('L', { unit: 'rem', spacing: { sm: 0.5 } })]
    });
    expect(r.tokens.spacing['xs']).toMatchObject({ value: 0.25, level: 'general' });
    expect(r.tokens.spacing['sm']).toMatchObject({ value: 0.5, level: 'local' });
  });

  it('противоречие локального общему даёт design_conflict', () => {
    const r = resolveDesign({
      general: [rec('G', { unit: 'rem', spacing: { xs: 0.25 } })],
      local: [rec('L', { unit: 'rem', spacing: { xs: 0.5 } })]
    });
    expect(r.checks.some((c) => c.code === 'design_conflict')).toBe(true);
    expect(r.conflicts.length).toBeGreaterThan(0);
  });

  it('два проекта получают одни и те же значения от одного эталона', () => {
    const a = resolveDesign({ general: [etalon], local: [] });
    const b = resolveDesign({ general: [etalon], local: [] });
    expect(plainTokens(a.tokens)).toEqual(plainTokens(b.tokens));
  });
});

describe('проверки токенов', () => {
  it('контраст WCAG: чёрное на белом 21:1, одинаковое 1:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('эталон PRAXIS: пары текст/фон держат 4.5:1, кроме названного отступления onAccent', () => {
    const r = resolveDesign({ general: [etalon], local: [] });
    expect(r.empty).toBe(false);
    const low = r.checks.filter((c) => c.code === 'design_contrast_low');
    // В D-0001 отступление onAccent светлой темы (~2.3:1) названо владельцем; других нет.
    for (const c of low) expect(c.pair).toEqual(['onAccent', 'accent']);
    expect(r.checks.filter((c) => c.code === 'design_theme_incomplete')).toEqual([]);
    expect(r.checks.filter((c) => c.code === 'design_block_invalid')).toEqual([]);
    const light = r.contrast.filter((row) => row.theme === 'light' && row.pair[0] === 'ink' && row.pair[1] === 'bg');
    expect(light[0]?.ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('нарочно плохая пара даёт design_contrast_low', () => {
    const r = resolveDesign({
      general: [rec('G', { unit: 'rem', palette: { light: { ink: '#cccccc', bg: '#ffffff' }, dark: { ink: '#ffffff', bg: '#000000' } } })],
      local: []
    });
    const c = r.checks.find((x) => x.code === 'design_contrast_low' && x.theme === 'light');
    expect(c?.pair).toEqual(['ink', 'bg']);
    expect(c?.ratio).toBeLessThan(4.5);
    expect(r.checks.some((x) => x.code === 'design_contrast_low' && x.theme === 'dark' && x.pair?.[0] === 'ink')).toBe(false);
  });

  it('роль только в одной теме даёт design_theme_incomplete', () => {
    const r = resolveDesign({
      general: [rec('G', { unit: 'rem', palette: { light: { ink: '#000000', bg: '#ffffff', warn: '#aa5500' }, dark: { ink: '#ffffff', bg: '#000000' } } })],
      local: []
    });
    const c = r.checks.find((x) => x.code === 'design_theme_incomplete');
    expect(c).toBeTruthy();
    expect(JSON.stringify(c)).toContain('warn');
  });

  it('нет body в шкале типографики даёт design_scale_gap', () => {
    const r = resolveDesign({
      general: [rec('G', { unit: 'rem', typography: { caption: { size: 0.75, line: 1, weight: 400 } } })],
      local: []
    });
    const c = r.checks.find((x) => x.code === 'design_scale_gap' && x.message.includes('типографики'));
    expect(c?.names).toContain('body');
  });
});
