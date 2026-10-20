import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { plainTokens, resolveDesign } from '../server/lib/design';
import {
  REPORTS_DIR,
  buildInventory,
  captureScript,
  isDesignReport,
  latestReports,
  parseFindings,
  screenSlug,
  shotPath,
  type DesignReport
} from '../server/lib/design-screens';
import { designPrompt } from '../server/lib/prompt';
import { designScreenFindings } from '../server/lib/rules';
import { currentFindings, readDesignReports, writeDesignReport } from '../server/utils/design-screens-service';
import { context } from './helpers';

/**
 * Проверка экранов моделью (R-0033, V-0033, часть unit): опись снимков, сборка
 * запроса, разбор ответа в находки, маршруты `findings/preview` и `findings/apply`
 * (их тело — тот же `parseFindings` плюс `writeDesignReport`) без записи в реальный проект.
 */

const SCREENS = [{ id: 'S-home', title: 'Главная' }, { id: 'S-login' }];
const NOW = Date.parse('2026-10-11T10:00:00Z');

const inventory = buildInventory({
  screens: SCREENS,
  files: [
    { path: shotPath('docs/development/design/screens', 'S-home', 375, 'light'), mtimeMs: NOW },
    { path: 'docs/development/design/mockups/S-home.png', mtimeMs: NOW }
  ]
});

const block = (value: unknown) => `Вывод.\n\`\`\`docdd-design-findings\n${JSON.stringify(value)}\n\`\`\`\n`;

describe('опись снимков', () => {
  it('экран × ширина × тема; какие есть, каких нет, когда снят', () => {
    expect(inventory.widths).toEqual([375, 768, 1280]);
    expect(inventory.themes).toEqual(['light', 'dark']);
    expect(inventory.total).toBe(12);
    expect(inventory.missing).toBe(11);
    const home = inventory.screens[0]!;
    expect(home.shots[0]).toMatchObject({ width: 375, theme: 'light', present: true, takenAt: new Date(NOW).toISOString() });
    expect(home.shots[1]).toMatchObject({ width: 375, theme: 'dark', present: false, takenAt: null });
    expect(home.mockup).toBe('docs/development/design/mockups/S-home.png');
    expect(inventory.screens[1]!.mockup).toBeNull();
  });

  it('имя каталога экрана не уходит из каталога снимков', () => {
    expect(screenSlug('../../etc')).not.toContain('/');
    expect(screenSlug('..')).toBe('screen');
    expect(screenSlug('a\\b/c')).toBe('a-b-c');
    expect(shotPath('x/', screenSlug('../a'), 375, 'dark').split('/')).not.toContain('..');
  });

  it('нет экранов — пустая опись, скрипт снятия собирается', () => {
    const empty = buildInventory({ screens: [], files: [] });
    expect(empty).toMatchObject({ total: 0, missing: 0 });
    expect(captureScript(empty)).toContain('375, 768, 1280');
  });

  it('своё имя темы и ширины берутся в опись', () => {
    const custom = buildInventory({ screens: SCREENS, files: [], widths: [320], themes: ['light', 'sepia'] });
    expect(custom.total).toBe(4);
    expect(custom.screens[0]!.shots.map((shot) => shot.path.split('/').pop())).toEqual(['320-light.png', '320-sepia.png']);
  });
});

describe('разбор ответа модели', () => {
  it('находка с экраном, шириной и темой; чистый экран — в clean', () => {
    const out = parseFindings(block({
      pass: 'responsive',
      findings: [{ screen: 'S-home', width: 375, theme: 'dark', what: 'Таблица шире экрана', expected: 'без скролла', actual: '+40 px' }],
      clean: ['S-login']
    }), inventory);
    expect(out.problems).toEqual([]);
    expect(out.pass).toBe('responsive');
    expect(out.findings).toEqual([{ screen: 'S-home', width: 375, theme: 'dark', what: 'Таблица шире экрана', expected: 'без скролла', actual: '+40 px' }]);
    expect(out.clean).toEqual(['S-login']);
  });

  it('экран, ширина и тема не из описи отбрасываются и называются', () => {
    const out = parseFindings(block({
      pass: 'pixel',
      findings: [
        { screen: 'S-ghost', width: 375, theme: 'light', what: 'x' },
        { screen: 'S-home', width: 500, theme: 'light', what: 'x' },
        { screen: 'S-home', width: 375, theme: 'sepia', what: 'x' },
        { screen: 'S-home', width: 375, theme: 'light', what: '  ' },
        'не объект'
      ],
      clean: ['S-ghost']
    }), inventory);
    expect(out.findings).toEqual([]);
    expect(out.clean).toEqual([]);
    expect(out.problems).toHaveLength(5);
    expect(out.pass).toBe('pixel');
  });

  it('нет блока, не JSON и не объект — problems, без падения', () => {
    expect(parseFindings('просто текст', inventory).problems[0]).toContain('нет блока');
    expect(parseFindings('```docdd-design-findings\n{oops\n```', inventory).problems[0]).toContain('не разобран');
    expect(parseFindings('```docdd-design-findings\n[]\n```', inventory).problems).toEqual(['Блок должен быть объектом.']);
    expect(parseFindings(block({ pass: 'responsive' }), inventory)).toMatchObject({ findings: [], clean: [], problems: [] });
  });

  it('ширина строкой-числом принимается', () => {
    const out = parseFindings(block({ pass: 'responsive', findings: [{ screen: 'S-home', width: '768', theme: 'light', what: 'a' }] }), inventory);
    expect(out.findings[0]?.width).toBe(768);
  });
});

describe('сборка запроса', () => {
  const resolved = resolveDesign({
    general: [],
    local: [{ id: 'D-1', body: `\`\`\`docdd-design\n${JSON.stringify({
      unit: 'rem', spacing: { md: 1 }, palette: { light: { bg: '#FFFFFF' }, dark: { bg: '#000000' } }, grid: { columns: 12, gutter: 1.5 }
    })}\n\`\`\`\n` }]
  });
  const tokens = plainTokens(resolved.tokens);

  for (const [name, expected] of [['design-responsive.md', 'responsive'], ['design-pixel-perfect.md', 'pixel']] as const) {
    it(`${name}: токены и опись подставлены, маркеров не осталось`, () => {
      const template = readFileSync(join(__dirname, '..', 'docs', 'prompts', name), 'utf8');
      const prompt = designPrompt(template, tokens, inventory);
      expect(prompt).not.toContain('<!-- ТОКЕНЫ -->');
      expect(prompt).not.toContain('<!-- СНИМКИ -->');
      expect(prompt).toContain('Сетка: 12 колонок');
      expect(prompt).toContain('### S-home — Главная');
      expect(prompt).toContain('375 px, тема light: `docs/development/design/screens/S-home/375-light.png`');
      expect(prompt).toContain('375 px, тема dark: нет');
      expect(prompt).toContain('Макет: `docs/development/design/mockups/S-home.png`');
      expect(prompt).toContain('Макета нет');
      expect(prompt).toContain(`"pass": "${expected}"`);
    });
  }
});

describe('отчёты: принять, прочитать, нарушения', () => {
  const dir = mkdtempSync(join(tmpdir(), 'docdd-screens-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('apply пишет отчёт внутри корня проекта и только в каталог отчётов', () => {
    const checked = parseFindings(block({ pass: 'pixel', findings: [{ screen: 'S-home', width: 768, theme: 'dark', what: 'Цвет не из токенов' }], clean: ['S-login'] }), inventory);
    const path = writeDesignReport(dir, { pass: 'pixel', findings: checked.findings, clean: checked.clean, actor: 'тест' }, new Date('2026-10-11T10:00:00Z'));
    expect(path).toBe(`${REPORTS_DIR}/2026-10-11-pixel-100000.json`);
    expect(existsSync(join(dir, path))).toBe(true);
    expect(readdirSync(dir).sort()).toEqual(['docs']);

    const reports = readDesignReports(dir);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ kind: 'design-findings', pass: 'pixel', actor: 'тест' });
    expect(currentFindings(dir)).toEqual([{ pass: 'pixel', finding: checked.findings[0] }]);
  });

  it('действует свежий отчёт прохода, старый остаётся историей', () => {
    const mk = (taken_at: string, what: string): DesignReport => ({
      contract: 'docdd.workspace/1', kind: 'design-findings', pass: 'responsive', taken_at, actor: 'a',
      findings: [{ screen: 'S-home', width: 375, theme: 'light', what }], clean: []
    });
    const latest = latestReports([mk('2026-10-02T00:00:00Z', 'новая'), mk('2026-10-01T00:00:00Z', 'старая')]);
    expect(latest.responsive?.findings[0]?.what).toBe('новая');
    expect(latest.pixel).toBeUndefined();
  });

  it('находки отчёта становятся design_screen_finding с экраном, шириной и темой', () => {
    const report: DesignReport = {
      contract: 'docdd.workspace/1', kind: 'design-findings', pass: 'responsive', taken_at: '2026-10-11T10:00:00Z', actor: 'a',
      findings: [{ screen: 'S-home', width: 375, theme: 'dark', what: 'Скролл', expected: 'нет', actual: 'есть' }], clean: []
    };
    const found = designScreenFindings({ ...context([]), designReports: [report] });
    expect(found.map((item) => item.code)).toEqual(['design_screen_finding']);
    expect(found[0]!.message).toContain('S-home');
    expect(found[0]!.message).toContain('375 px');
    expect(found[0]!.message).toContain('тема dark');
    expect(designScreenFindings(context([]))).toEqual([]);
  });

  it('битый отчёт не роняет чтение; чужой JSON — не отчёт', () => {
    expect(isDesignReport({ kind: 'other' })).toBe(false);
    expect(isDesignReport(null)).toBe(false);
    expect(readDesignReports(join(dir, 'нет-такого'))).toEqual([]);
  });
});
