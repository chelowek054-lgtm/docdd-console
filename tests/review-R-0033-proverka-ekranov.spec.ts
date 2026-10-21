// V-0033 manual — подготовка
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { resolveDesign } from '../server/lib/design';
import { buildInventory, parseFindings, shotPath } from '../server/lib/design-screens';
import { designPrompt } from '../server/lib/prompt';
import { plainTokens } from '../server/lib/design';

/**
 * Подготовка ручной проверки R-0033: три находки из текста V-0033 (свой цвет
 * вместо accent, отступ 13 px, горизонтальный скролл на 375) принимаются с
 * экраном, шириной и темой; шаблоны обоих проходов содержат нужные пункты.
 * Сам взгляд модели на снимки — за человеком.
 */

const read = (name: string) => readFileSync(new URL(`../docs/prompts/${name}`, import.meta.url), 'utf8');
const inventory = buildInventory({
  screens: [{ id: 'S-a' }, { id: 'S-b' }],
  files: [
    { path: shotPath('docs/development/design/screens', 'S-a', 375, 'light'), mtimeMs: 1 },
    { path: shotPath('docs/development/design/screens', 'S-b', 375, 'dark'), mtimeMs: 1 }
  ]
});
const answer = (value: unknown) => '```docdd-design-findings\n' + JSON.stringify(value) + '\n```';

describe('находки из сценария V-0033', () => {
  it('цвет, отступ и скролл — по экрану, ширине и теме; чистый экран в clean', () => {
    const pixel = parseFindings(answer({ pass: 'pixel', findings: [
      { screen: 'S-a', width: 375, theme: 'light', what: 'Свой цвет', expected: 'accent', actual: '#ff00aa' },
      { screen: 'S-a', width: 768, theme: 'dark', what: 'Отступ 13 px', expected: 'из шкалы', actual: '13 px' }
    ], clean: ['S-b'] }), inventory);
    const resp = parseFindings(answer({ pass: 'responsive', findings: [{ screen: 'S-b', width: 1280, theme: 'dark', what: 'Горизонтальный скролл' }] }), inventory);
    expect(pixel.findings.map((f) => `${f.screen}/${f.width}/${f.theme}`)).toEqual(['S-a/375/light', 'S-a/768/dark']);
    expect(pixel.clean).toEqual(['S-b']);
    expect(resp.findings[0]).toMatchObject({ screen: 'S-b', width: 1280, theme: 'dark' });
    expect(pixel.problems).toEqual([]);
  });
});

describe('шаблоны проходов', () => {
  it('Responsive: скролл, обрезка, шапка, 44 px, отступ из шкалы, три ширины экранов по умолчанию', () => {
    const t = read('design-responsive.md');
    for (const part of ['Горизонтальный скролл', 'Обрезанное', 'Шапка', '44 px', 'Отступ по краю', 'docdd-design-findings']) expect(t).toContain(part);
    expect(inventory.widths).toEqual([375, 768, 1280]);
    expect(inventory.themes).toEqual(['light', 'dark']);
  });

  it('Pixel-Perfect: цвет, кегль, отступы, радиусы, макет; модель только находит', () => {
    const t = read('design-pixel-perfect.md');
    for (const part of ['Цвет', 'Кегль', 'Отступы', 'Радиусы', 'Макет']) expect(t).toContain(part);
    expect(t).toMatch(/ничего не (меняй|правь)|только находит/i);
  });

  it('запрос подставляет токены проекта и опись снимков', () => {
    const tokens = plainTokens(resolveDesign({ general: [{ id: 'D', body: '```docdd-design\n{"unit":"rem","spacing":{"xs":0.25}}\n```' }], local: [] }).tokens);
    const out = designPrompt(read('design-responsive.md'), tokens, inventory);
    expect(out).not.toContain('<!-- ТОКЕНЫ -->');
    expect(out).not.toContain('<!-- СНИМКИ -->');
    expect(out).toContain('S-a');
  });
});
