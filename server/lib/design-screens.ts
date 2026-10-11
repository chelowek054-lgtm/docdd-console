/**
 * Проверка экранов проекта моделью (docs/16-design-system.md, «Проверка экранов
 * моделью»): опись снимков по экрану, ширине и теме, разбор ответа модели в
 * находки. Чистые функции — файловая система и запуск модели снаружи.
 *
 * Снимков приложение не делает (ADR-0022): их кладёт проект. Здесь только
 * вопрос «какие есть, каких нет» и разбор того, что ответила модель.
 */

/** Имя темы проекта: светлая, тёмная или добавленная (docs/16-design-system.md). */
export type ScreenTheme = string;

export const DEFAULT_WIDTHS: readonly number[] = [375, 768, 1280];
/** Пока проект не назвал темы, снимаются обе базовые. */
export const DEFAULT_THEMES: readonly ScreenTheme[] = ['light', 'dark'];
export const DEFAULT_SCREENS_DIR = 'docs/development/design/screens';
export const DEFAULT_MOCKUPS_DIR = 'docs/development/design/mockups';
export const REPORTS_DIR = 'docs/development/design/reports';

export const MOCKUP_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'md'] as const;

export interface ScreenInput {
  id: string;
  title?: string | undefined;
}

export interface FileStat {
  /** Путь от корня проекта, с `/`. */
  path: string;
  mtimeMs: number;
}

export interface Shot {
  width: number;
  theme: ScreenTheme;
  /** Где снимок должен лежать. */
  path: string;
  present: boolean;
  /** Когда снят (по времени файла); `null`, пока снимка нет. */
  takenAt: string | null;
}

export interface ScreenInventory {
  id: string;
  title: string;
  /** Имя каталога экрана: идентификатор без символов, неудобных в путях. */
  slug: string;
  shots: Shot[];
  /** Путь эталонного макета, если он лежит. */
  mockup: string | null;
}

export interface DesignScreens {
  screens: ScreenInventory[];
  total: number;
  missing: number;
  widths: number[];
  themes: ScreenTheme[];
  screensDir: string;
  mockupsDir: string;
}

/** `S-home` → `S-home`, `Экран входа/шаг 1` → `Экран-входа-шаг-1`: каталог без разделителей путей. */
export function screenSlug(id: string): string {
  const slug = id.trim().replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '');
  return slug === '' || slug === '.' || slug === '..' ? 'screen' : slug;
}

const trimDir = (dir: string) => dir.replace(/\\/g, '/').replace(/\/+$/g, '');

export function shotPath(screensDir: string, slug: string, width: number, theme: ScreenTheme): string {
  return `${trimDir(screensDir)}/${slug}/${width}-${theme}.png`;
}

export function buildInventory(input: {
  screens: readonly ScreenInput[];
  files: readonly FileStat[];
  screensDir?: string | undefined;
  mockupsDir?: string | undefined;
  widths?: readonly number[] | undefined;
  themes?: readonly ScreenTheme[] | undefined;
}): DesignScreens {
  const screensDir = trimDir(input.screensDir ?? DEFAULT_SCREENS_DIR);
  const mockupsDir = trimDir(input.mockupsDir ?? DEFAULT_MOCKUPS_DIR);
  const widths = [...(input.widths?.length ? input.widths : DEFAULT_WIDTHS)];
  const themes = [...(input.themes?.length ? input.themes : DEFAULT_THEMES)];
  const byPath = new Map(input.files.map((file) => [file.path.replace(/\\/g, '/'), file.mtimeMs]));

  const screens: ScreenInventory[] = input.screens.map((screen) => {
    const slug = screenSlug(screen.id);
    const shots: Shot[] = [];
    for (const width of widths) {
      for (const theme of themes) {
        const path = shotPath(screensDir, slug, width, theme);
        const mtime = byPath.get(path);
        shots.push({
          width,
          theme,
          path,
          present: mtime !== undefined,
          takenAt: mtime !== undefined ? new Date(mtime).toISOString() : null
        });
      }
    }
    const mockup = MOCKUP_EXTENSIONS.map((extension) => `${mockupsDir}/${slug}.${extension}`).find((path) => byPath.has(path)) ?? null;
    return { id: screen.id, title: screen.title ?? screen.id, slug, shots, mockup };
  });

  const all = screens.flatMap((screen) => screen.shots);
  return {
    screens,
    total: all.length,
    missing: all.filter((shot) => !shot.present).length,
    widths,
    themes,
    screensDir,
    mockupsDir
  };
}

/**
 * Шаблон скрипта снятия: текст, который человек копирует в проект. Адреса
 * экранов приложение не знает (карта путей описывает экраны, а не URL), поэтому
 * подставлены заготовки.
 */
export function captureScript(inventory: DesignScreens): string {
  const routes = inventory.screens.map((screen) => `  '${screen.slug}': '/', // ${screen.title}: подставьте адрес экрана`);
  return [
    '// Снятие экранов для проверки дизайна (docs/16-design-system.md). Веб: браузер без окна.',
    '// Запуск: node capture-screens.mjs http://localhost:3000',
    "import { chromium } from 'playwright';",
    "import { mkdirSync } from 'node:fs';",
    '',
    "const base = process.argv[2] ?? 'http://localhost:3000';",
    `const widths = [${inventory.widths.join(', ')}];`,
    `const themes = [${inventory.themes.map((theme) => `'${theme}'`).join(', ')}];`,
    `const dir = '${inventory.screensDir}';`,
    'const routes = {',
    ...routes,
    '};',
    '',
    'const browser = await chromium.launch();',
    'for (const [slug, route] of Object.entries(routes)) {',
    '  mkdirSync(`${dir}/${slug}`, { recursive: true });',
    '  for (const width of widths) {',
    '    for (const theme of themes) {',
    "      const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: theme === 'dark' ? 'dark' : 'light' });",
    '      await page.goto(base + route, { waitUntil: "networkidle" });',
    "      // Тема включается классом на корне: `.dark` и `.theme-<имя>` из выгрузки токенов.",
    "      await page.evaluate((name) => name !== 'light' && document.documentElement.classList.add(name === 'dark' ? 'dark' : `theme-${name}`), theme);",
    '      await page.screenshot({ path: `${dir}/${slug}/${width}-${theme}.png`, fullPage: true });',
    '      await page.close();',
    '    }',
    '  }',
    '}',
    'await browser.close();',
    '',
    '// Expo, Android, iOS: снимок эмулятора или симулятора под тем же именем —',
    '//   adb exec-out screencap -p > <dir>/<экран>/<ширина>-<тема>.png',
    '//   xcrun simctl io booted screenshot <dir>/<экран>/<ширина>-<тема>.png'
  ].join('\n');
}

/* ---------- находки модели ---------- */

export type ScreenPass = 'responsive' | 'pixel';

export const PASS_LABEL: Readonly<Record<ScreenPass, string>> = {
  responsive: 'Responsive',
  pixel: 'Pixel-Perfect'
};

export interface ScreenFinding {
  screen: string;
  width: number;
  theme: ScreenTheme;
  what: string;
  expected?: string | undefined;
  actual?: string | undefined;
}

export interface FindingsOutcome {
  pass: ScreenPass | null;
  findings: ScreenFinding[];
  clean: string[];
  /** Что не принято: находка не про известный экран, ширину или тему, блок не разобрался. */
  problems: string[];
}

const BLOCK = /```docdd-design-findings\s*\n([\s\S]*?)```/g;

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Ответ модели → находки. Находка про экран, ширину или тему, которых нет в
 * описи, не принимается: модель могла выдумать то, чего у проекта нет, и
 * молча занести это в нарушения нельзя.
 */
export function parseFindings(answer: string, inventory: DesignScreens): FindingsOutcome {
  const problems: string[] = [];
  const findings: ScreenFinding[] = [];
  const clean = new Set<string>();
  let pass: ScreenPass | null = null;

  const matches = [...answer.matchAll(BLOCK)];
  if (matches.length === 0) {
    return { pass, findings, clean: [], problems: ['В ответе нет блока `docdd-design-findings`.'] };
  }

  const knownScreens = new Map(inventory.screens.map((screen) => [screen.id, screen] as const));
  for (const match of matches) {
    let raw: unknown;
    try {
      raw = JSON.parse(match[1] ?? '');
    } catch (error) {
      problems.push(`Блок не разобран: ${error instanceof Error ? error.message : String(error)}.`);
      continue;
    }
    if (!isObject(raw)) {
      problems.push('Блок должен быть объектом.');
      continue;
    }
    if (raw['pass'] === 'responsive' || raw['pass'] === 'pixel') pass = raw['pass'];

    for (const item of Array.isArray(raw['findings']) ? raw['findings'] : []) {
      if (!isObject(item)) {
        problems.push('Находка должна быть объектом.');
        continue;
      }
      const screen = typeof item['screen'] === 'string' ? item['screen'] : '';
      const width = typeof item['width'] === 'number' ? item['width'] : Number(item['width']);
      const theme = item['theme'];
      const what = typeof item['what'] === 'string' ? item['what'].trim() : '';
      if (!knownScreens.has(screen)) {
        problems.push(`Экран \`${screen || '—'}\` не из карты пользовательских путей: находка отброшена.`);
        continue;
      }
      if (!inventory.widths.includes(width)) {
        problems.push(`Ширина ${String(item['width'])} не из проверяемых (${inventory.widths.join(', ')}): находка по \`${screen}\` отброшена.`);
        continue;
      }
      if (typeof theme !== 'string' || !inventory.themes.includes(theme)) {
        problems.push(`Тема \`${String(theme)}\` не из проверяемых (${inventory.themes.join(', ')}): находка по \`${screen}\` отброшена.`);
        continue;
      }
      if (what === '') {
        problems.push(`У находки по \`${screen}\` нет описания: отброшена.`);
        continue;
      }
      findings.push({
        screen,
        width,
        theme,
        what,
        ...(typeof item['expected'] === 'string' ? { expected: item['expected'] } : {}),
        ...(typeof item['actual'] === 'string' ? { actual: item['actual'] } : {})
      });
    }
    for (const id of Array.isArray(raw['clean']) ? raw['clean'] : []) {
      if (typeof id === 'string' && knownScreens.has(id)) clean.add(id);
    }
  }

  return { pass, findings, clean: [...clean], problems };
}

/** Строка отчёта прохода, который человек принял. */
export interface DesignReport {
  contract: 'docdd.workspace/1';
  kind: 'design-findings';
  pass: ScreenPass;
  taken_at: string;
  actor: string;
  findings: ScreenFinding[];
  clean: string[];
}

/** Последний отчёт каждого прохода: старые остаются историей, действует свежий. */
export function latestReports(reports: readonly DesignReport[]): Partial<Record<ScreenPass, DesignReport>> {
  const latest: Partial<Record<ScreenPass, DesignReport>> = {};
  for (const report of reports) {
    const current = latest[report.pass];
    if (!current || report.taken_at >= current.taken_at) latest[report.pass] = report;
  }
  return latest;
}

export function isDesignReport(value: unknown): value is DesignReport {
  return isObject(value)
    && value['kind'] === 'design-findings'
    && (value['pass'] === 'responsive' || value['pass'] === 'pixel')
    && typeof value['taken_at'] === 'string'
    && Array.isArray(value['findings'])
    && Array.isArray(value['clean']);
}
