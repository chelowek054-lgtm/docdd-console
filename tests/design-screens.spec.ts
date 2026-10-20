import { describe, expect, it } from 'vitest';

import { buildInventory, captureScript, parseFindings } from '../server/lib/design-screens';

/**
 * R-0034: проверка экранов идёт по точкам сетки и по всем включённым темам, а не только
 * по светлой и тёмной (ADR-0023, п. 6); находка про чужую тему не принимается.
 */

const screens = [{ id: 'S-home', title: 'Главная' }];
const inventory = buildInventory({ screens, files: [], themes: ['light', 'dark', 'ocean'], widths: [375, 1280] });

describe('проверка экранов: сетка и темы', () => {
  it('снимки — по каждой ширине и каждой теме, включая добавленные', () => {
    expect(inventory.screens[0]?.shots).toHaveLength(2 * 3);
    expect(inventory.total).toBe(6);
    expect(inventory.missing).toBe(6);
    expect(inventory.screens[0]?.shots.map((s) => s.path)).toContain('docs/development/design/screens/S-home/375-ocean.png');
  });

  it('без заданных тем — светлая и тёмная', () => {
    expect(buildInventory({ screens, files: [] }).themes).toEqual(['light', 'dark']);
  });

  it('скрипт снятия включает тему классом на корне', () => {
    const script = captureScript(inventory);
    expect(script).toContain("'light', 'dark', 'ocean'");
    expect(script).toContain('theme-');
  });

  it('находка по теме из списка принимается, по чужой, ширине или экрану — отбрасывается', () => {
    const block = (item: object) => '```docdd-design-findings\n' + JSON.stringify({ pass: 'responsive', findings: [item] }) + '\n```';
    const ok = parseFindings(block({ screen: 'S-home', width: 375, theme: 'ocean', what: 'Текст сливается с фоном' }), inventory);
    expect(ok.findings).toHaveLength(1);
    for (const bad of [
      { screen: 'S-home', width: 375, theme: 'sepia', what: 'x' },
      { screen: 'S-home', width: 999, theme: 'ocean', what: 'x' },
      { screen: 'S-nope', width: 375, theme: 'ocean', what: 'x' },
      { screen: 'S-home', width: 375, theme: 'ocean', what: ' ' }
    ]) {
      const out = parseFindings(block(bad), inventory);
      expect(out.findings).toEqual([]);
      expect(out.problems.length).toBe(1);
    }
  });

  it('ответ без блока — проблема, а не пустой успех', () => {
    expect(parseFindings('всё хорошо', inventory).problems).toHaveLength(1);
  });
});
