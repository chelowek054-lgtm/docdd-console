import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { analyze } from '../lib/analyze';
import {
  DEFAULT_MOCKUPS_DIR,
  DEFAULT_SCREENS_DIR,
  REPORTS_DIR,
  buildInventory,
  captureScript,
  isDesignReport,
  latestReports,
  type DesignReport,
  type DesignScreens,
  type FileStat,
  type ScreenFinding,
  type ScreenPass
} from '../lib/design-screens';
import { approvedMaps, foldMaps, parseMapRecord } from '../lib/maps';
import { normalizeRoot, resolveInside } from '../lib/paths';
import { readManifest, readWorkspace } from '../lib/workspace';
import { themeNames } from '../lib/design';
import { projectDesign } from './design-service';

/**
 * Снимки экранов и находки проверки (docs/16-design-system.md). Читает файлы
 * внутри корня проекта: каталог снимков называет манифест, наружу корня путь
 * не выходит (`resolveInside`). Снимки приложение не делает — их кладёт проект.
 */

/** Файлы каталога рекурсивно, пути от корня проекта с `/`. Нет каталога — пусто. */
export function listFiles(root: string, relative: string): FileStat[] {
  const out: FileStat[] = [];
  let base: string;
  try {
    base = resolveInside(root, relative);
  } catch {
    return out;
  }
  if (!existsSync(base)) return out;

  const walk = (absolute: string, prefix: string) => {
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      const path = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) walk(join(absolute, entry.name), path);
      else if (entry.isFile()) out.push({ path, mtimeMs: statSync(join(absolute, entry.name)).mtimeMs });
    }
  };
  walk(base, relative.replace(/\\/g, '/').replace(/\/+$/g, ''));
  return out;
}

export interface ScreensReport extends DesignScreens {
  /** Экраны взяты из подтверждённой карты пользовательских путей; `false` — карты нет. */
  fromMap: boolean;
  script: string;
}

export function projectScreens(root: string): ScreensReport {
  const normalized = normalizeRoot(root);
  const manifest = readManifest(normalized);
  const workspace = readWorkspace(normalized);
  const { records } = analyze({ files: workspace.files, manifest });
  const picture = foldMaps(approvedMaps(records).map((record) => ({ id: record.id, change: parseMapRecord(record.body).change })));
  const screens = picture.userflow.screens.map((screen) => ({ id: screen.id, title: screen.title }));

  const design = manifest.design ?? {};
  const screensDir = design.screens ?? DEFAULT_SCREENS_DIR;
  const mockupsDir = design.mockups ?? DEFAULT_MOCKUPS_DIR;
  const inventory = buildInventory({
    screens,
    files: [...listFiles(normalized, screensDir), ...listFiles(normalized, mockupsDir)],
    screensDir,
    mockupsDir,
    widths: design.widths,
    themes: design.themes ?? projectThemes(normalized)
  });
  return { ...inventory, fromMap: screens.length > 0, script: captureScript(inventory, darkThemesOf(normalized)) };
}

/** Принятые отчёты проверки экранов: файлы JSON в каталоге отчётов проекта. */
export function readDesignReports(root: string): DesignReport[] {
  const normalized = normalizeRoot(root);
  const reports: DesignReport[] = [];
  for (const file of listFiles(normalized, REPORTS_DIR)) {
    if (!file.path.endsWith('.json')) continue;
    try {
      const parsed: unknown = JSON.parse(readFileSync(resolveInside(normalized, file.path), 'utf8'));
      if (isDesignReport(parsed)) reports.push(parsed);
    } catch {
      // Битый файл отчёта — не повод ронять экран: его просто не видно среди находок.
    }
  }
  return reports;
}

/** Находки последних отчётов каждого прохода — то, что попадает в нарушения. */
export function currentFindings(root: string): { pass: ScreenPass; finding: ScreenFinding }[] {
  const latest = latestReports(readDesignReports(root));
  return (['responsive', 'pixel'] as const).flatMap((pass) =>
    (latest[pass]?.findings ?? []).map((finding) => ({ pass, finding }))
  );
}

/** Запись принятого человеком отчёта: `<дата>-<проход>-<время>.json`, как отчёты прогонов. */
export function writeDesignReport(
  root: string,
  input: { pass: ScreenPass; findings: ScreenFinding[]; clean: string[]; actor: string },
  now = new Date()
): string {
  const normalized = normalizeRoot(root);
  const stamp = now.toISOString();
  const name = `${stamp.slice(0, 10)}-${input.pass}-${stamp.slice(11, 19).replace(/:/g, '')}.json`;
  const relative = `${REPORTS_DIR}/${name}`;
  const absolute = resolveInside(normalized, relative);

  const report: DesignReport = {
    contract: 'docdd.workspace/1',
    kind: 'design-findings',
    pass: input.pass,
    taken_at: stamp,
    actor: input.actor,
    findings: input.findings,
    clean: input.clean
  };
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return relative;
}

/**
 * Темы снимков, когда манифест их не назвал: все темы проекта — светлая, тёмная
 * и добавленные блоком. Дизайн не подключён — по умолчанию обе базовые.
 */
function projectThemes(root: string): string[] | undefined {
  try {
    const design = projectDesign(root);
    return design.empty ? undefined : themeNames(design.tokens);
  } catch {
    return undefined;
  }
}

/** Темы на базе `dark`: скрипту снятия нужно знать, каким темам включать `.dark` (docs/16-design-system.md). */
function darkThemesOf(root: string): string[] {
  try {
    const design = projectDesign(root);
    if (design.empty) return [];
    return themeNames(design.tokens).filter((name) => name !== 'light' && name !== 'dark' && design.tokens.themes[name]?.mode?.value === 'dark');
  } catch {
    return [];
  }
}
