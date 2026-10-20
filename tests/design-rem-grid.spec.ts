import { describe, expect, it } from 'vitest';

import { DEFAULT_GRID, DEFAULT_ROOT, parseDesignBlocks, plainTokens, resolveDesign } from '../server/lib/design';
import { exportStack } from '../server/lib/design-export';

/**
 * Единица rem и глобальная сетка в формате docdd-design и выгрузке (R-0034,
 * V-0034, docs/16-design-system.md и ADR-0023): без `unit: "rem"` блок не
 * принимается, сетка разбирается и уходит во все четыре стека.
 */

const record = (value: unknown) => ({ id: 'D-1', body: `\`\`\`docdd-design\n${JSON.stringify(value)}\n\`\`\`\n` });
const tokensOf = (value: unknown) => plainTokens(resolveDesign({ general: [], local: [record(value)] }).tokens);

describe('единица rem', () => {
  it('блок без unit или с px не принимается и называет причину', () => {
    const none = parseDesignBlocks(record({ spacing: { md: 1 } }));
    expect(none.blocks).toEqual([]);
    expect(none.problems[0]!.message).toContain('unit');
    const px = parseDesignBlocks(record({ unit: 'px', spacing: { md: 16 } }));
    expect(px.blocks).toEqual([]);
    expect(px.problems[0]!.message).toContain('`px`');
  });

  it('root: положительное число; 0 и отрицательное — отказ', () => {
    expect(parseDesignBlocks(record({ unit: 'rem', root: 0 })).problems).toHaveLength(1);
    expect(parseDesignBlocks(record({ unit: 'rem', root: -4 })).problems).toHaveLength(1);
    expect(tokensOf({ unit: 'rem' }).root).toBe(DEFAULT_ROOT);
    expect(tokensOf({ unit: 'rem', root: 10 }).root).toBe(10);
  });

  it('отрицательные размеры отвергаются', () => {
    expect(parseDesignBlocks(record({ unit: 'rem', spacing: { md: -1 } })).problems.length).toBeGreaterThan(0);
  });
});

describe('глобальная сетка', () => {
  it('разбирает колонки, поле, точки перелома и контейнеры', () => {
    const tokens = tokensOf({
      unit: 'rem',
      grid: { columns: 8, gutter: 1, breakpoints: { xs: 0, sm: 30 }, containers: { sm: 28 } }
    });
    expect(tokens.grid).toEqual({ columns: 8, gutter: 1, breakpoints: { xs: 0, sm: 30 }, containers: { sm: 28 } });
  });

  it('нет сетки в блоке — образец Bootstrap 5 в rem', () => {
    expect(tokensOf({ unit: 'rem' }).grid).toEqual(DEFAULT_GRID);
  });

  it('негодная сетка называется, остальное принимается', () => {
    for (const grid of [{ columns: 0 }, { columns: 1.5 }, { gutter: -1 }, { breakpoints: [] }, { containers: { sm: -2 } }, 'x']) {
      expect(parseDesignBlocks(record({ unit: 'rem', grid })).problems.length, JSON.stringify(grid)).toBeGreaterThan(0);
    }
    const mixed = parseDesignBlocks(record({ unit: 'rem', spacing: { md: 1 }, grid: { columns: 0 } }));
    expect(mixed.blocks[0]!.spacing).toEqual({ md: 1 });
  });

  it('точки перелома должны возрастать — иначе design_scale_gap', () => {
    const resolution = resolveDesign({ general: [], local: [record({ unit: 'rem', grid: { breakpoints: { xs: 0, sm: 48, md: 36 } } })] });
    expect(resolution.checks.some((check) => check.code === 'design_scale_gap' && /перелом/.test(check.message))).toBe(true);
  });
});

describe('сетка и rem в выгрузке', () => {
  const tokens = tokensOf({ unit: 'rem', root: 16, grid: { columns: 12, gutter: 1.5, breakpoints: { xs: 0, sm: 36 }, containers: { sm: 33.75 } } });

  it('веб: rem в переменных и классы сетки; корень не задаётся в px', () => {
    const css = exportStack('nuxt-ui', tokens).files[0]!.content;
    expect(css).toContain('--ds-grid-columns: 12;');
    expect(css).toContain('--ds-grid-gutter: 1.5rem;');
    expect(css).toContain('@media (min-width: 36rem)');
    expect(css).toContain('.ds-container { max-width: 33.75rem; }');
    expect(css).not.toMatch(/html\s*\{[^}]*font-size:\s*\d+px/);
    const config = exportStack('nuxt-ui', tokens).files[1]!.content;
    expect(config).toContain('"unit": "rem"');
  });

  it('платформы без rem: gutter 1.5rem × 16 = 24, точка 36rem = 576', () => {
    expect(exportStack('expo', tokens).files[0]!.content).toMatch(/gutter: 24/);
    expect(exportStack('compose', tokens).files.map((file) => file.content).join('\n')).toContain('24.dp');
    expect(exportStack('compose', tokens).files.map((file) => file.content).join('\n')).toContain('576');
    expect(exportStack('swiftui', tokens).files[0]!.content).toMatch(/gutter: CGFloat = 24/);
  });

  it('другой root меняет только платформы без rem', () => {
    const big = tokensOf({ unit: 'rem', root: 20, grid: { gutter: 1.5 } });
    expect(exportStack('expo', big).files[0]!.content).toMatch(/gutter: 30/);
    expect(exportStack('nuxt-ui', big).files[0]!.content).toContain('--ds-grid-gutter: 1.5rem;');
  });
});
