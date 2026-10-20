import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  compareVersions, contrastRatio, hslOf, paletteColorPractice, plainTokens, resolveDesign, MAX_FILL_SATURATION, FILL_ROLES
} from '../server/lib/design';
import { diffAgainst, figmaBlockText, figmaColor, parseFigmaVariables } from '../server/lib/design-figma';
import { exportStack, versionOfFile } from '../server/lib/design-export';

/**
 * R-0035 (импорт из Figma, версия и изменения), R-0036 (практика цвета, ADR-0026),
 * R-0037 (палитра эталона). Ожидания взяты из текстов требований и ADR, не из кода.
 */

const REFERENCE = resolve(__dirname, '../practices/docs/development/design/D-0001-edinyy-dizayn-praxis-tokeny.md');
const reference = () => {
  const resolution = resolveDesign({ general: [{ id: 'D-0001', body: readFileSync(REFERENCE, 'utf8') }], local: [] });
  return { resolution, plain: plainTokens(resolution.tokens) };
};
const block = (value: object) => '```docdd-design\n' + JSON.stringify(value) + '\n```';

const mode = (id: string, name: string) => ({ modeId: id, name });
const figma = (variables: Record<string, unknown>) => ({
  meta: {
    variableCollections: { c1: { modes: [mode('m1', 'Light'), mode('m2', 'Dark'), mode('m3', 'OLED')] } },
    variables
  }
});
const colorVar = (name: string, light: object, dark: object, oled?: object) => ({
  name, resolvedType: 'COLOR', variableCollectionId: 'c1',
  valuesByMode: { m1: light, m2: dark, m3: oled ?? dark }
});

describe('T-0081 импорт из Figma Variables', () => {
  it('переводит цвет 0..1 в #RRGGBB и учитывает прозрачность', () => {
    expect(figmaColor({ r: 1, g: 0, b: 0 })).toBe('#FF0000');
    expect(figmaColor({ r: 0, g: 0.5, b: 1, a: 1 })).toBe('#0080FF');
    expect(figmaColor({ r: 0, g: 0, b: 0, a: 0.5 })).toBe('#00000080');
  });

  it('палитра: Light и Dark — базовые темы, прочие режимы — добавленные', () => {
    const result = parseFigmaVariables(figma({
      a: colorVar('palette/accent', { r: 0, g: 1, b: 0 }, { r: 0, g: 0.5, b: 0 }, { r: 0, g: 0.2, b: 0 })
    }));
    expect(result.problems).toEqual([]);
    const out = result.block as { palette: Record<string, Record<string, string>>; themes: Record<string, { mode: string; palette: Record<string, string> }> };
    expect(out.palette['light']?.['accent']).toBe('#00FF00');
    expect(out.palette['dark']?.['accent']).toBe('#008000');
    expect(out.themes['oled']?.palette['accent']).toBe('#003300');
  });

  it('числа в px делятся на root, строки font/<имя> — семейства', () => {
    const result = parseFigmaVariables(figma({
      s: { name: 'spacing/md', resolvedType: 'FLOAT', variableCollectionId: 'c1', valuesByMode: { m1: 16 } },
      t: { name: 'typography/body/size', resolvedType: 'FLOAT', variableCollectionId: 'c1', valuesByMode: { m1: 15 } },
      w: { name: 'typography/body/weight', resolvedType: 'FLOAT', variableCollectionId: 'c1', valuesByMode: { m1: 400 } },
      f: { name: 'font/body', resolvedType: 'STRING', variableCollectionId: 'c1', valuesByMode: { m1: ' Inter ' } }
    }), 16);
    const out = result.block as { spacing: Record<string, number>; typography: Record<string, Record<string, number>>; fonts: Record<string, string> };
    expect(out.spacing['md']).toBe(1);
    expect(out.typography['body']?.['size']).toBe(0.9375);
    expect(out.typography['body']?.['weight']).toBe(400);
    expect(out.fonts['body']).toBe('Inter');
  });

  it('разыменовывает алиасы', () => {
    const result = parseFigmaVariables(figma({
      base: colorVar('palette/ink', { r: 0, g: 0, b: 0 }, { r: 1, g: 1, b: 1 }),
      alias: { name: 'palette/muted', resolvedType: 'COLOR', variableCollectionId: 'c1', valuesByMode: { m1: { type: 'VARIABLE_ALIAS', id: 'base' }, m2: { type: 'VARIABLE_ALIAS', id: 'base' } } }
    }));
    const out = result.block as { palette: Record<string, Record<string, string>> };
    expect(out.palette['light']?.['muted']).toBe('#000000');
    expect(out.palette['dark']?.['muted']).toBe('#FFFFFF');
  });

  it('непонятное не теряется молча — идёт в skipped с причиной', () => {
    const result = parseFigmaVariables(figma({
      a: colorVar('palette/unknownRole', { r: 0, g: 0, b: 0 }, { r: 1, g: 1, b: 1 }),
      b: { name: 'misc/thing', resolvedType: 'FLOAT', variableCollectionId: 'c1', valuesByMode: { m1: 3 } },
      c: { name: 'flag', resolvedType: 'BOOLEAN', variableCollectionId: 'c1', valuesByMode: { m1: true } }
    }));
    expect(result.skipped.map((item) => item.name).sort()).toEqual(['flag', 'misc/thing', 'palette/unknownRole']);
    expect(result.skipped.every((item) => item.reason !== '')).toBe(true);
    expect(result.problems.length).toBeGreaterThan(0);
  });

  it('пустое и чужое — понятная проблема, без исключения', () => {
    for (const input of [null, 42, 'x', [], {}, { meta: {} }, { meta: { variables: {} } }]) {
      const result = parseFigmaVariables(input);
      expect(result.block).toBeDefined();
      expect(result.problems.length).toBeGreaterThan(0);
    }
  });

  it('принимает и целый ответ API, и саму meta', () => {
    const variables = { a: colorVar('palette/bg', { r: 1, g: 1, b: 1 }, { r: 0, g: 0, b: 0 }) };
    const whole = parseFigmaVariables({ error: false, status: 200, ...figma(variables) });
    const part = parseFigmaVariables(figma(variables).meta);
    expect(part.block).toEqual(whole.block);
  });

  it('сверка: называет только то, что сменится; ключ вне импорта не трогает', () => {
    const { plain } = reference();
    const accent = plain.palette.light['accent'] as string;
    const diff = diffAgainst(plain, {
      palette: { light: { accent: '#123456', ink: plain.palette.light['ink'] } },
      spacing: { md: plain.spacing['md'] }
    });
    expect(diff).toEqual([{ key: 'palette.light.accent', before: accent, after: '#123456' }]);
    expect(diffAgainst(plain, {})).toEqual([]);
  });

  it('сверка: новый ключ — before null', () => {
    const { plain } = reference();
    const diff = diffAgainst(plain, { spacing: { huge: 9 }, themes: { sunset: { palette: { accent: '#FF8800' } } } });
    expect(diff).toContainEqual({ key: 'spacing.huge', before: null, after: '9' });
    expect(diff).toContainEqual({ key: 'themes.sunset.accent', before: null, after: '#FF8800' });
  });

  it('блок собирается в запись design и сам разбирается обратно', () => {
    const result = parseFigmaVariables(figma({ a: colorVar('palette/bg', { r: 1, g: 1, b: 1 }, { r: 0.1, g: 0.1, b: 0.1 }) }));
    const text = figmaBlockText(result.block);
    expect(text.startsWith('```docdd-design\n')).toBe(true);
    const back = resolveDesign({ general: [{ id: 'D-X', body: text }], local: [] });
    expect(back.problems).toEqual([]);
    expect(back.tokens.palette.light['bg']?.value).toBe('#FFFFFF');
  });
});

describe('T-0082 версия токенов и список изменений', () => {
  it('сравнивает версии числами, а не строками', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.2.0', '1.2.0')).toBe(0);
    expect(compareVersions('0.9.9', '1.0.0')).toBeLessThan(0);
  });

  it('versionOfFile читает версию из шапки выгрузки; без шапки — null', () => {
    const { plain } = reference();
    const files = exportStack('nuxt-ui', plain).files;
    expect(files.some((file) => versionOfFile(file.content) === plain.version)).toBe(true);
    expect(versionOfFile(null)).toBeNull();
    expect(versionOfFile('просто файл')).toBeNull();
  });

  it('изменения копятся новыми сверху; негодная запись — design_block_invalid', () => {
    const body = block({
      unit: 'rem', version: '1.10.0',
      changes: [
        { version: '1.9.0', summary: 'раньше' },
        { version: '1.10.0', summary: 'позже', date: '2026-10-11' },
        { version: 'x', summary: 'плохая' },
        { version: '1.0.0', summary: '' }
      ]
    });
    const result = resolveDesign({ general: [{ id: 'D-X', body }], local: [] });
    expect(result.tokens.changes.map((item) => item.value.version)).toEqual(['1.10.0', '1.9.0']);
    expect(result.checks.some((check) => check.code === 'design_block_invalid')).toBe(true);
  });

  it('эталон: версия — первая в списке изменений, список от новой к старой без повторов', () => {
    const { plain, resolution } = reference();
    expect(resolution.problems).toEqual([]);
    expect(plain.changes[0]?.version).toBe(plain.version);
    for (let at = 1; at < plain.changes.length; at += 1) {
      expect(compareVersions(plain.changes[at - 1]!.version, plain.changes[at]!.version)).toBeGreaterThan(0);
    }
  });

  it('без версии — design_scale_gap про version', () => {
    const result = resolveDesign({ general: [{ id: 'D-X', body: block({ unit: 'rem' }) }], local: [] });
    expect(result.checks.some((check) => check.code === 'design_scale_gap' && check.names?.includes('version'))).toBe(true);
  });
});

describe('T-0084 практика цвета (ADR-0026)', () => {
  const ctx = (over: Partial<Parameters<typeof paletteColorPractice>[1]> = {}) =>
    ({ name: 'dark', mode: 'dark' as const, minContrast: 4.5, markets: [] as string[], ...over });

  it('чистый чёрный фон в тёмной теме вне oled — замечание; в oled — нет', () => {
    expect(paletteColorPractice({ bg: '#000000' }, ctx())).toHaveLength(1);
    expect(paletteColorPractice({ bg: '#000000' }, ctx({ name: 'oled' }))).toEqual([]);
    expect(paletteColorPractice({ bg: '#000000' }, ctx({ mode: 'light', name: 'light' }))).toEqual([]);
  });

  it('контрастная тема (minContrast >= 7) — исключение', () => {
    expect(paletteColorPractice({ bg: '#000000', accent: '#00FF00' }, ctx({ name: 'contrast', minContrast: 7 }))).toEqual([]);
  });

  it('насыщенность 90-100 % при средней светлоте — замечание, ниже — нет', () => {
    expect(paletteColorPractice({ accent: '#00FF00' }, ctx())).toHaveLength(1);
    expect(paletteColorPractice({ accent: '#22C55E' }, ctx())).toEqual([]);
    expect(paletteColorPractice({ accent: '#000A00' }, ctx())).toEqual([]);
  });

  it('красный danger для CN/HK/TW — замечание; для RU — нет; оранжево-красный — нет', () => {
    expect(paletteColorPractice({ danger: '#E5252A' }, ctx({ markets: ['CN'] }))).toHaveLength(1);
    expect(paletteColorPractice({ danger: '#E5252A' }, ctx({ markets: ['RU'] }))).toEqual([]);
    expect(paletteColorPractice({ danger: '#E8731A' }, ctx({ markets: ['TW'] }))).toEqual([]);
  });

  it('уличный продукт без темы 7:1 — design_color_practice; с темой — нет', () => {
    const base = {
      unit: 'rem', version: '1.0.0',
      palette: { light: { bg: '#FFFFFF', ink: '#111111' }, dark: { bg: '#222222', ink: '#EEEEEE' } }
    };
    const run = (extra: object) => resolveDesign({
      general: [{ id: 'D-X', body: block({ ...base, ...extra }) }], local: []
    }).checks.filter((check) => check.code === 'design_color_practice');
    expect(run({ audience: { markets: ['RU'], outdoor: true } })).toHaveLength(1);
    expect(run({ audience: { outdoor: true }, themes: { contrast: { mode: 'light', minContrast: 7, palette: { bg: '#FFFFFF' } } } })).toEqual([]);
    expect(run({ audience: { outdoor: false } })).toEqual([]);
  });

  it('audience: рынки читаются, негодное — design_block_invalid', () => {
    const result = resolveDesign({ general: [{ id: 'D-X', body: block({ unit: 'rem', audience: { markets: ['CN', 'RU'], outdoor: true } }) }], local: [] });
    expect(plainTokens(result.tokens).audience).toEqual({ markets: ['CN', 'RU'], outdoor: true });
    const bad = resolveDesign({ general: [{ id: 'D-Y', body: block({ unit: 'rem', audience: { outdoor: 'да' } }) }], local: [] });
    expect(bad.checks.some((check) => check.code === 'design_block_invalid')).toBe(true);
  });

  it('тема oled в эталоне: истинно чёрный фон, на базе dark, без замечаний', () => {
    const { plain, resolution } = reference();
    expect(plain.themes['oled']?.mode).toBe('dark');
    expect(plain.themes['oled']?.palette['bg']).toBe('#000000');
    expect(resolution.checks.filter((check) => check.code === 'design_color_practice' && check.theme === 'oled')).toEqual([]);
  });

  it('выгрузка в веб включает тему contrast при prefers-contrast: more', () => {
    const { plain } = reference();
    expect(plain.themes['contrast']).toBeDefined();
    const text = exportStack('nuxt-ui', plain).files.map((file) => file.content).join('\n');
    expect(text).toContain('@media (prefers-contrast: more)');
  });
});

describe('T-0085/T-0086 палитра эталона (текущая версия)', () => {
  it('в списке изменений есть v1.4.0 и v1.5.0 подряд, с непустым описанием', () => {
    const { plain } = reference();
    const versions = plain.changes.map((item) => item.version);
    expect(versions.indexOf('1.5.0')).toBe(versions.indexOf('1.4.0') - 1);
    expect(versions.indexOf('1.4.0')).toBeGreaterThan(0);
    expect(plain.changes.every((item) => item.summary.trim() !== '')).toBe(true);
  });

  it('насыщенность больших заливок ниже 90 % во всех темах (ADR-0026)', () => {
    const { plain } = reference();
    // Контрастная тема (minContrast >= 7) — исключение из правила (ADR-0026).
    const palettes = [plain.palette.light, plain.palette.dark, ...Object.values(plain.themes).filter((theme) => theme.minContrast < 7).map((theme) => theme.palette)];
    for (const palette of palettes) {
      for (const role of FILL_ROLES) {
        const color = palette[role];
        if (!color || !/^#[0-9A-F]{6}$/i.test(color)) continue;
        const { s, l } = hslOf(color);
        if (l > 0.12 && l < 0.88) expect(s, `${role} ${color}`).toBeLessThan(MAX_FILL_SATURATION);
      }
    }
  });

  it('эталон проходит проверку токенов без замечаний практики, конфликтов и негодных блоков', () => {
    const { resolution } = reference();
    const codes = resolution.checks.map((check) => check.code);
    for (const code of ['design_color_practice', 'design_conflict', 'design_block_invalid', 'design_theme_incomplete', 'design_scale_gap'] as const) {
      expect(codes, code).not.toContain(code);
    }
  });

  it('текстовые пары держат 4.5:1 (кроме известного отступления onAccent/accent светлой темы)', () => {
    const { resolution } = reference();
    const low = resolution.contrast.filter((row) => !row.ok).map((row) => `${row.theme}:${row.pair.join('/')}`);
    expect(low).toEqual(['light:onAccent/accent']);
  });

  it('цвета смысла ok/warn/danger/core читаются на bg и surface не ниже 4.5:1', () => {
    const { plain } = reference();
    const failures: string[] = [];
    for (const [name, palette] of [['light', plain.palette.light], ['dark', plain.palette.dark]] as const) {
      for (const role of ['ok', 'warn', 'danger', 'core']) {
        for (const ground of ['bg', 'surface']) {
          const ratio = contrastRatio(palette[role]!, palette[ground]!);
          if (ratio < 4.5) failures.push(`${name}:${role}/${ground}=${ratio.toFixed(2)}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
