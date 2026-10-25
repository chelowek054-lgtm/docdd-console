import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { analyze } from '../lib/analyze';
import { coverageOf, coveredFiles, findTests, matchTests, parseTestReport, proposeChecks, verificationsFromReport, type Coverage, type TestMatch } from '../lib/test-checks';
import { normalizeRoot, OutsideRootError, resolveInside } from '../lib/paths';
import { DEVELOPMENT_DIR } from '../lib/types';
import { invalidateWorkspace, readWorkspace } from '../lib/workspace';
import { dropCache } from '../lib/cache';

import { createRecords } from './inbox-service';
import { listProjectFiles } from './source-scan';

/**
 * Проверки из существующих тестов (R-0079): находка тестовых файлов, сопоставление с
 * требованиями, заведение проверок-черновиков и подключение отчёта сборки раннера.
 */

/** Сколько байт из начала файла читается в поисках номера требования: обычно номер стоит в комментарии наверху. */
const HEAD_BYTES = 2048;
const MAX_TEST_FILES = 600;

function readHead(root: string, path: string): string {
  try { return readFileSync(resolveInside(root, path), 'utf8').slice(0, HEAD_BYTES); } catch { return ''; }
}

function packageJson(root: string): { scripts?: Record<string, string>; devDependencies?: Record<string, string>; dependencies?: Record<string, string> } | null {
  try { return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')); } catch { return null; }
}

export interface TestsReport {
  matches: TestMatch[];
  coverage: Coverage;
  /** Тестовых файлов найдено и сколько из них уже названо в проверках. */
  found: number;
  already: number;
}

function loadProject(root: string) {
  const workspace = readWorkspace(root);
  return analyze({ files: workspace.files, manifest: workspace.manifest, reports: workspace.reports, codeFiles: workspace.codeFiles }).records
    .filter((record) => !['superseded', 'rejected', 'dropped', 'legacy'].includes(record.status));
}

export function scanTests(root: string): TestsReport {
  const base = normalizeRoot(root);
  const records = loadProject(base);
  const requirements = records.filter((record) => record.type === 'requirement').map((record) => ({ id: record.id, title: record.title }));
  const checks = records.filter((record) => record.type === 'verification');
  const tests = findTests(listProjectFiles(base).filter((path) => !path.startsWith('docs/development/')), packageJson(base)).slice(0, MAX_TEST_FILES);
  const matches = matchTests(tests, requirements, (path) => readHead(base, path));
  const already = coveredFiles(checks.map((check) => ({ command: String(check.data['command'] ?? ''), body: check.body })));
  const withLinks = new Set(requirements.filter((req) => (records.find((r) => r.id === req.id)?.links.verified_by ?? []).length > 0).map((req) => req.id));
  const coverage = coverageOf(requirements, checks, withLinks);
  return { matches, coverage, found: tests.length, already: tests.filter((test) => already.has(test.path)).length };
}

export type CreateOutcome = { ok: true; created: number; ids: string[] } | { ok: false; code: string; message: string };

/** Заводит проверки-черновики по сопоставленным тестам; `only` — только названные человеком файлы. */
export function createTestChecks(root: string, only?: readonly string[]): CreateOutcome {
  const base = normalizeRoot(root);
  const records = loadProject(base);
  const already = coveredFiles(records.filter((record) => record.type === 'verification').map((check) => ({ command: String(check.data['command'] ?? ''), body: check.body })));
  const report = scanTests(base);
  const wanted = only ? report.matches.filter((item) => only.includes(item.test.path)) : report.matches;
  const proposed = proposeChecks(wanted, already);
  if (proposed.length === 0) return { ok: true, created: 0, ids: [] };
  const outcome = createRecords(base, proposed, []);
  return outcome.ok ? { ok: true, created: outcome.created.length, ids: outcome.created.map((item) => item.id) } : { ok: false, code: outcome.code, message: outcome.message };
}

export type ReportOutcome =
  | { ok: true; report: string; matched: number; unmatched: string[]; format: string }
  | { ok: false; code: string; message: string };

const REPORT_LIMIT = 8 * 1024 * 1024;

/**
 * Подключает отчёт сборки раннера: файл по пути проекта (JSON vitest/jest или JUnit-XML) разбирается,
 * итоги сопоставляются с проверками по файлам из их команд, и пишется обычный отчёт в `tests/reports`.
 */
export function connectReport(root: string, path: string): ReportOutcome {
  const base = normalizeRoot(root);
  let text: string;
  try {
    const absolute = resolveInside(base, path);
    if (!statSync(absolute).isFile() || statSync(absolute).size > REPORT_LIMIT) return { ok: false, code: 'report_unreadable', message: 'Отчёт не файл или слишком большой' };
    text = readFileSync(absolute, 'utf8');
  } catch (error) {
    // Выход за корень — не «файла нет»: маршрут отвечает 403, а не подсказывает, что лежит снаружи.
    if (error instanceof OutsideRootError) throw error;
    return { ok: false, code: 'report_not_found', message: `Отчёта \`${path}\` нет` };
  }
  const parsed = parseTestReport(text);
  if (!parsed.format) return { ok: false, code: 'report_unknown', message: 'Формат отчёта не распознан: нужен JSON vitest/jest или JUnit-XML' };

  const records = loadProject(base);
  const checks = records.filter((record) => record.type === 'verification').map((check) => ({
    id: check.id,
    files: [...coveredFiles([{ command: String(check.data['command'] ?? ''), body: check.body }])]
  })).filter((check) => check.files.length > 0);
  const { verifications, unmatched } = verificationsFromReport(parsed.results, checks);
  if (Object.keys(verifications).length === 0) return { ok: false, code: 'report_no_match', message: 'Ни один файл отчёта не совпал с командами проверок: заведите проверки из тестов и повторите' };

  const folder = readWorkspace(base).manifest.paths?.tests;
  if (!folder) return { ok: false, code: 'tests_not_configured', message: 'В манифесте не назван раздел `paths.tests`: отчёту некуда лечь' };
  const started = new Date();
  const failed = Object.values(verifications).filter((state) => state === 'failed').length;
  const name = `${started.toISOString().slice(0, 10)}-ci-${started.toISOString().slice(11, 19).replace(/:/g, '')}.json`;
  const dir = resolveInside(base, join(DEVELOPMENT_DIR, folder, 'reports'));
  mkdirSync(dir, { recursive: true });
  if (existsSync(join(dir, name))) return { ok: false, code: 'report_exists', message: 'Отчёт за эту секунду уже записан' };
  writeFileSync(join(dir, name), JSON.stringify({
    contract: 'docdd.workspace/1', runner: `ci:${parsed.format}`, started_at: started.toISOString(),
    total: Object.keys(verifications).length, failed, note: `из ${path}`, verifications
  }, null, 2) + '\n', 'utf8');
  dropCache(base);
  invalidateWorkspace(base);
  return { ok: true, report: name, matched: Object.keys(verifications).length, unmatched, format: parsed.format };
}
