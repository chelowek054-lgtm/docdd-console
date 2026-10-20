import { describe, expect, it } from 'vitest';

import { resolveDesign, themePalette, themeNames, plainTokens, type DesignCheck } from '../server/lib/design';
import { exportStack } from '../server/lib/design-export';

/**
 * R-0034 (V-0034): rem, сетка, расширяемые темы, i18n; R-0035 (V-0035): практика в формате
 * (шрифты, строка, линии, значки, движение, фокус, контрастная тема 7:1, состояния).
 * Тесты написаны по тексту docs/16-design-system.md и ADR-0023/0024, не по коду.
 */

const light = {
  bg: '#FFFFFF', surface: '#F4F6F8', surfaceAlt: '#E9EDF1', ink: '#16202A', muted: '#4A5663', line: '#D5DBE1',
  accent: '#0B6E4F', accentText: '#0B6E4F', onAccent: '#FFFFFF', core: '#2B5FD9', ok: '#1A7F37', info: '#1F6FEB',
  warn: '#8A6A2A', danger: '#B3261E', onDanger: '#FFFFFF', focus: '#0B5FA5'
};
const dark = {
  bg: '#0E141A', surface: '#161E26', surfaceAlt: '#1E2832', ink: '#E8EEF3', muted: '#A9B6C2', line: '#2C3844',
  accent: '#4CC38A', accentText: '#4CC38A', onAccent: '#06210F', core: '#8AA6E6', ok: '#56C27A', info: '#7DB0E6',
  warn: '#E0B050', danger: '#E69A94', onDanger: '#220604', focus: '#8CC4FF'
};
const scale = (names: string[], make: (i: number) => unknown) => Object.fromEntries(names.map((n, i) => [n, make(i)]));
const HC = { ink: '#000000', muted: '#222222', accentText: '#004D2E', accent: '#004D2E', danger: '#7A0000', focus: '#003366' };

function block(extra: Record<string, unknown> = {}, drop: string[] = []): string {
  const base: Record<string, unknown> = {
    unit: 'rem',
    version: '1.0.0',
    typography: scale(['caption', 'small', 'body', 'lead', 'title', 'display'], (i) => ({ size: 0.75 + i * 0.25, line: 1.1 + i * 0.25, weight: 400 })),
    spacing: scale(['xs', 'sm', 'md', 'lg', 'xl', 'xxl'], (i) => 0.25 * (i + 1)),
    radius: { sm: 0.5, md: 0.75, pill: 62.5 },
    border: { thin: 0.0625, thick: 0.125 },
    icon: { sm: 1, md: 1.25, lg: 1.5 },
    motion: { fast: 100, base: 200, slow: 400 },
    fonts: { body: 'system-ui, sans-serif' },
    measure: 70,
    grid: {
      columns: 12, gutter: 1.5,
      breakpoints: { xs: 0, sm: 36, md: 48, lg: 62, xl: 75, xxl: 87.5 },
      containers: { sm: 33.75, md: 45, lg: 60, xl: 71.25, xxl: 82.5 }
    },
    palette: { light, dark },
    i18n: { default: 'ru', locales: ['ru', 'en'], fallback: 'en' },
    components: ['TopBar', 'Card', 'Button', 'Field', 'Pill', 'Progress', 'Empty'].map((name) => ({
      name, summary: name, ...(name === 'Button' || name === 'Field' ? { states: ['default', 'focus', 'disabled'] } : {})
    })),
    ...extra
  };
  for (const key of drop) delete base[key];
  return '```docdd-design\n' + JSON.stringify(base) + '\n```';
}

const run = (extra: Record<string, unknown> = {}, drop: string[] = []) =>
  resolveDesign({ general: [{ id: 'D-0001', body: block(extra, drop) }], local: [] });
const codes = (checks: DesignCheck[]) => checks.map((c) => c.code);
const exported = (r: ReturnType<typeof run>, id: 'nuxt-ui' | 'expo' | 'compose' | 'swiftui') =>
  exportStack(id, plainTokens(r.tokens)).files.map((f) => f.content).join('\n');

describe('R-0034: адаптивность', () => {
  it('исходный блок проходит без нарушений', () => {
    const r = run();
    expect(r.problems).toEqual([]);
    expect(r.checks.map((c) => c.message)).toEqual([]);
  });

  it('блок без unit: "rem" не принимается', () => {
    const body = block().replace('"unit":"rem",', '');
    const r = resolveDesign({ general: [{ id: 'D-1', body }], local: [] });
    expect(r.problems.length).toBeGreaterThan(0);
  });

  it('доп. тема наследует базу и переопределяет только названные роли', () => {
    const r = run({ themes: { ocean: { label: 'Океан', mode: 'light', palette: { accent: '#0B5FA5' } } } });
    expect(themeNames(r.tokens)).toContain('ocean');
    const p = themePalette(r.tokens, 'ocean');
    expect(p['accent']?.value).toBe('#0B5FA5');
    expect(p['bg']?.value).toBe(light.bg);
    expect(r.contrast.some((row) => row.theme === 'ocean')).toBe(true);
  });

  it('тема на базе dark наследует от dark', () => {
    const r = run({ themes: { night: { mode: 'dark', palette: { accent: '#5DD39E' } } } });
    expect(themePalette(r.tokens, 'night')['bg']?.value).toBe(dark.bg);
  });

  it('контраст проверяется у каждой темы: слабая тема даёт design_contrast_low с её именем', () => {
    const r = run({ themes: { pale: { mode: 'light', palette: { ink: '#CCCCCC' } } } });
    const low = r.checks.filter((c) => c.code === 'design_contrast_low');
    expect(low.length).toBeGreaterThan(0);
    expect(low.every((c) => c.theme === 'pale')).toBe(true);
  });

  it('неизвестная роль в теме — проблема разбора', () => {
    const r = run({ themes: { odd: { mode: 'light', palette: { nonsense: '#000000' } } } });
    expect(r.problems.length).toBeGreaterThan(0);
  });

  it('имя темы light или с заглавной — отказ', () => {
    expect(run({ themes: { light: { mode: 'light', palette: { accent: '#0B5FA5' } } } }).problems.length).toBeGreaterThan(0);
    expect(run({ themes: { Ocean: { mode: 'light', palette: { accent: '#0B5FA5' } } } }).problems.length).toBeGreaterThan(0);
  });

  it('сетка: точки перелома не возрастают — design_scale_gap', () => {
    const r = run({ grid: { columns: 12, gutter: 1.5, breakpoints: { xs: 0, sm: 48, md: 36, lg: 62, xl: 75, xxl: 87.5 },
      containers: { sm: 33.75, md: 45, lg: 60, xl: 71.25, xxl: 82.5 } } });
    expect(codes(r.checks)).toContain('design_scale_gap');
  });

  it('сетки нет — design_scale_gap', () => {
    expect(codes(run({}, ['grid']).checks)).toContain('design_scale_gap');
  });

  it('i18n: нет блока, один язык, нет en, default или fallback не из списка — design_i18n_missing', () => {
    expect(codes(run({}, ['i18n']).checks)).toContain('design_i18n_missing');
    expect(codes(run({ i18n: { default: 'ru', locales: ['ru'], fallback: 'ru' } }).checks)).toContain('design_i18n_missing');
    expect(codes(run({ i18n: { default: 'ru', locales: ['ru', 'de'], fallback: 'de' } }).checks)).toContain('design_i18n_missing');
    expect(codes(run({ i18n: { default: 'fr', locales: ['ru', 'en'], fallback: 'en' } }).checks)).toContain('design_i18n_missing');
    expect(codes(run({ i18n: { default: 'ru', locales: ['ru', 'en'], fallback: 'de' } }).checks)).toContain('design_i18n_missing');
  });

  it('i18n: ru+en без нарушений, языки доходят до выгрузки каждого стека', () => {
    const r = run();
    expect(r.checks.filter((c) => c.code === 'design_i18n_missing')).toEqual([]);
    for (const id of ['nuxt-ui', 'expo', 'compose', 'swiftui'] as const) {
      const text = exported(r, id);
      expect(text, id).toMatch(/['"]ru['"]/);
      expect(text, id).toMatch(/['"]en['"]/);
    }
  });

  it('выгрузка в веб: rem, сетка и темы классами', () => {
    const r = run({ themes: { ocean: { mode: 'light', palette: { accent: '#0B5FA5' } } } });
    const css = exported(r, 'nuxt-ui');
    expect(css).toContain('font-size: 100%');
    expect(css).toContain('.theme-ocean');
    expect(css).toContain('ds-container');
    expect(css).toContain('ds-col-');
    expect(css).toContain('--breakpoint-');
  });
});

describe('R-0035: практика в формате', () => {
  it.each(['fonts', 'border', 'icon', 'motion', 'measure'])('нет %s — design_scale_gap', (key) => {
    expect(codes(run({}, [key]).checks)).toContain('design_scale_gap');
  });

  it('больше трёх семейств шрифтов — design_scale_gap', () => {
    const r = run({ fonts: { body: 'a', mono: 'b', display: 'c', extra: 'd' } });
    expect(codes(r.checks)).toContain('design_scale_gap');
  });

  it.each([44, 81])('measure %i вне 45–80 — design_scale_gap', (n) => {
    expect(codes(run({ measure: n }).checks)).toContain('design_scale_gap');
  });

  it.each([45, 80])('measure %i на границе допустим', (n) => {
    expect(run({ measure: n }).checks.filter((c) => c.code === 'design_scale_gap')).toEqual([]);
  });

  it('нет version — design_scale_gap', () => {
    expect(codes(run({}, ['version']).checks)).toContain('design_scale_gap');
  });

  it('у Button без состояний focus и disabled — design_scale_gap', () => {
    const components = ['TopBar', 'Card', 'Button', 'Field', 'Pill', 'Progress', 'Empty'].map((name) => ({ name, summary: name, states: ['default'] }));
    expect(codes(run({ components }).checks)).toContain('design_scale_gap');
  });

  it('фокус: focus/bg слабее 3:1 — design_contrast_low с порогом 3', () => {
    const r = run({ palette: { light: { ...light, focus: '#EEEEEE' }, dark } });
    expect(r.checks.some((c) => c.code === 'design_contrast_low' && c.pair?.join('/') === 'focus/bg')).toBe(true);
    expect(r.contrast.find((row) => row.pair.join('/') === 'focus/bg')?.min).toBe(3);
  });

  it('контрастная тема: minContrast 7 даёт порог 7; слабая пара не проходит', () => {
    const ok = run({ themes: { hc: { mode: 'light', minContrast: 7, palette: HC } } });
    const rows = ok.contrast.filter((row) => row.theme === 'hc');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((row) => row.pair[0] !== 'focus').every((row) => row.min === 7)).toBe(true);
    expect(ok.checks.filter((c) => c.code === 'design_contrast_low' && c.theme === 'hc')).toEqual([]);
    const weak = run({ themes: { hc: { mode: 'light', minContrast: 7, palette: { muted: '#6B7480' } } } });
    expect(weak.checks.some((c) => c.code === 'design_contrast_low' && c.theme === 'hc')).toBe(true);
  });

  it('minContrast ниже 4.5 не ослабляет проверку', () => {
    const r = run({ themes: { lax: { mode: 'light', minContrast: 2, palette: { ink: '#BBBBBB' } } } });
    const flagged = r.problems.length + r.checks.filter((c) => c.theme === 'lax' && c.code === 'design_contrast_low').length;
    expect(flagged).toBeGreaterThan(0);
  });

  it('«на улице» без темы 7:1 — design_color_practice; с ней — нет', () => {
    expect(codes(run({ audience: { outdoor: true } }).checks)).toContain('design_color_practice');
    const withHc = run({ audience: { outdoor: true }, themes: { hc: { mode: 'light', minContrast: 7, palette: HC } } });
    expect(withHc.checks.filter((c) => c.code === 'design_color_practice')).toEqual([]);
  });

  it('движение в выгрузке учитывает «уменьшить движение»', () => {
    expect(exported(run(), 'nuxt-ui')).toContain('prefers-reduced-motion');
  });

  it('незнакомые ключи блока сохраняются', () => {
    const r = run({ custom: { a: 1 } });
    expect(r.tokens.extra['custom']?.value).toEqual({ a: 1 });
  });
});
