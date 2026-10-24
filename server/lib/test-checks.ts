import type { ProposedRecord } from './inbox';

/**
 * Проверки из существующих тестов (R-0079, docs/04-ui.md, «Подключение»): находит
 * тестовые файлы проекта, сопоставляет их с требованиями и предлагает проверки вида
 * unit/integration с командой запуска; разбирает отчёт сборки раннера. Чистые
 * функции: файлы читает вызывающий, записи заводит `createRecords`.
 */

export interface TestFile {
  path: string;
  /** Раннер по пути и package.json: `vitest`, `jest`, `pytest`, `go`, `unknown`. */
  runner: string;
  /** Команда запуска одного файла — то, что запишется в проверку. */
  command: string;
  kind: 'unit' | 'integration';
}

const TEST_FILE = /(^|\/)((test_[^/]+\.py)|([^/]+_test\.(py|go))|([^/]+\.(spec|test)\.[cm]?[jt]sx?))$/;

export function isTestPath(path: string): boolean {
  return TEST_FILE.test(path);
}

export type PackageScripts = Record<string, string> | undefined;

/** Раннер JS-проекта по скриптам и зависимостям package.json; не понять — `vitest` не выдумываем. */
export function jsRunner(pkg: { scripts?: Record<string, string>; devDependencies?: Record<string, string>; dependencies?: Record<string, string> } | null): 'vitest' | 'jest' | 'unknown' {
  const text = `${JSON.stringify(pkg?.scripts ?? {})} ${Object.keys({ ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) }).join(' ')}`;
  if (/\bvitest\b/.test(text)) return 'vitest';
  if (/\bjest\b/.test(text)) return 'jest';
  return 'unknown';
}

/** Команда запуска файла; `npm run test --` — если в проекте есть такой скрипт, иначе прямой запуск раннера. */
export function commandFor(path: string, runner: string, hasTestScript: boolean): string {
  if (runner === 'pytest') return `pytest ${path}`;
  if (runner === 'go') return `go test ./${path.split('/').slice(0, -1).join('/') || '.'}`;
  if (runner === 'vitest' || runner === 'jest') return hasTestScript ? `npm run test -- ${path}` : `npx ${runner}${runner === 'vitest' ? ' run' : ''} ${path}`;
  return `npm run test -- ${path}`;
}

/** Тестовые файлы из списка путей — с раннером и командой. `pkg` — package.json корня, если он есть. */
export function findTests(paths: readonly string[], pkg: Parameters<typeof jsRunner>[0]): TestFile[] {
  const js = jsRunner(pkg);
  const hasScript = typeof pkg?.scripts?.['test'] === 'string';
  return paths.filter(isTestPath).sort().map((path) => {
    const runner = path.endsWith('.py') ? 'pytest' : path.endsWith('.go') ? 'go' : js;
    return { path, runner, command: commandFor(path, runner, hasScript), kind: /(^|\/)(integration|e2e|it)(\/|[._-])|[._-](integration|e2e)[._-]/.test(path) ? 'integration' : 'unit' };
  });
}

export interface RequirementRef { id: string; title: string }

export interface TestMatch {
  test: TestFile;
  /** Требование, которому проверка подходит; `null` — не нашлось. */
  requirement: RequirementRef | null;
  /** Почему подобрано: человеку проще подтвердить, когда видна причина. */
  why: string;
}

/** Идентификаторы требований в тексте: `R-0013`, `r0013`, `R_0013`. */
export function requirementIds(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/\bR[-_]?(\d{3,5})\b/gi)) found.add(`R-${(match[1] as string).padStart(4, '0')}`);
  return [...found];
}

const STOP = new Set(['test', 'tests', 'spec', 'specs', 'unit', 'integration', 'index', 'main', 'util', 'utils', 'helper', 'helpers', 'review']);

/** Значимые слова пути: по `-`, `_`, `.`, `/` и границам camelCase; короткие и служебные отброшены. */
export function pathWords(path: string): string[] {
  const name = path.replace(/\.[^.]+$/, '').replace(/\.(spec|test)$/, '');
  return [...new Set(name.split(/[\\/._-]+|(?<=[a-z])(?=[A-Z])/).map((word) => word.toLowerCase()).filter((word) => word.length >= 4 && !STOP.has(word) && !/^\d+$/.test(word)))];
}

/** Слово встречается в тексте как начало слова — окончание не мешает («requirement» ~ «requirements»). */
function mentions(text: string, word: string): boolean {
  const stem = word.length > 6 ? word.slice(0, -1) : word;
  return new RegExp(`(^|[^\\p{L}\\p{N}])${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'iu').test(text);
}

/**
 * Сопоставление теста и требования: сперва по явному номеру (в имени файла или в
 * его начале), затем по словам пути в заголовке требования. Явное главнее: номер
 * в имени — прямое указание автора теста. Неоднозначность (два требования с одним
 * счётом слов) — не угадываем, оставляем без требования.
 */
export function matchTests(tests: readonly TestFile[], requirements: readonly RequirementRef[], head: (path: string) => string = () => ''): TestMatch[] {
  const byId = new Map(requirements.map((item) => [item.id, item]));
  return tests.map((test) => {
    const explicit = requirementIds(`${test.path}\n${head(test.path)}`).map((id) => byId.get(id)).filter((item): item is RequirementRef => !!item);
    if (explicit.length >= 1) return { test, requirement: explicit[0] as RequirementRef, why: `номер ${(explicit[0] as RequirementRef).id} в имени или начале файла` };
    const words = pathWords(test.path);
    let best: { item: RequirementRef; hits: string[] }[] = [];
    let top = 0;
    for (const item of requirements) {
      const hits = words.filter((word) => mentions(item.title, word));
      if (hits.length > top) { top = hits.length; best = [{ item, hits }]; }
      else if (hits.length === top && top > 0) best.push({ item, hits });
    }
    if (top >= 2 && best.length === 1) return { test, requirement: (best[0] as (typeof best)[number]).item, why: `слова пути в заголовке: ${(best[0] as (typeof best)[number]).hits.join(', ')}` };
    return { test, requirement: null, why: top === 0 ? 'требование не нашлось' : 'подходит несколько требований — укажите номер в имени теста' };
  });
}

/** Файлы, на которые уже ссылаются проверки проекта (в `command` или в строке «Запуск: `…`»). */
export function coveredFiles(checks: readonly { command?: string; body?: string }[]): Set<string> {
  const covered = new Set<string>();
  for (const check of checks) {
    const text = `${check.command ?? ''}\n${check.body ?? ''}`;
    for (const match of text.matchAll(/(?:^|[\s`'"])([\w./-]+\.(?:spec|test)\.[cm]?[jt]sx?|[\w./-]*test_[\w-]+\.py|[\w./-]+_test\.(?:py|go))\b/g)) covered.add(match[1] as string);
  }
  return covered;
}

/** Предложения проверок: только сопоставленные и ещё не заведённые; черновики, ничего не перетирается. */
export function proposeChecks(matches: readonly TestMatch[], already: ReadonlySet<string>): ProposedRecord[] {
  return matches
    .filter((item) => item.requirement && !already.has(item.test.path))
    .map((item, at) => ({
      key: `test${at + 1}`,
      type: 'verification' as const,
      title: `Тесты: ${item.test.path}`,
      kind: item.test.kind,
      body: `Проверка требования ${(item.requirement as RequirementRef).id} существующим тестом (${item.why}).\n\nЗапуск: \`${item.test.command}\`.`,
      links: { verifies: [(item.requirement as RequirementRef).id] }
    }));
}

export interface Coverage { covered: RequirementRef[]; uncovered: RequirementRef[]; percent: number }

/** Какие требования покрыты проверкой (любой): видно сразу, без ручного заведения. */
export function coverageOf(requirements: readonly RequirementRef[], checks: readonly { links: { verifies?: readonly string[] } }[], requirementsWithChecks: ReadonlySet<string> = new Set()): Coverage {
  const verified = new Set(requirementsWithChecks);
  for (const check of checks) for (const id of check.links.verifies ?? []) verified.add(id);
  const covered = requirements.filter((item) => verified.has(item.id));
  const uncovered = requirements.filter((item) => !verified.has(item.id));
  return { covered, uncovered, percent: requirements.length ? Math.round((covered.length / requirements.length) * 100) : 0 };
}

// --- отчёт сборки раннера ---

export type TestState = 'passed' | 'failed' | 'skipped';
export interface TestResult { file: string; state: TestState }

const worse = (a: TestState, b: TestState): TestState => (a === 'failed' || b === 'failed' ? 'failed' : a === 'passed' || b === 'passed' ? 'passed' : 'skipped');

function merge(results: Map<string, TestState>, file: string, state: TestState): void {
  const key = file.replace(/\\/g, '/').replace(/^\.\//, '');
  results.set(key, results.has(key) ? worse(results.get(key) as TestState, state) : state);
}

/** JSON-отчёт vitest/jest (`testResults[].name` и `status`): итог по файлу. */
export function parseJsonReport(text: string): TestResult[] {
  let data: { testResults?: { name?: string; status?: string; assertionResults?: { status?: string }[] }[] };
  try { data = JSON.parse(text); } catch { return []; }
  const results = new Map<string, TestState>();
  for (const file of data.testResults ?? []) {
    if (!file.name) continue;
    const cases = (file.assertionResults ?? []).map((item) => item.status);
    const state: TestState = file.status === 'failed' || cases.includes('failed') ? 'failed' : cases.length > 0 && cases.every((s) => s === 'pending' || s === 'skipped') ? 'skipped' : 'passed';
    merge(results, file.name, state);
  }
  return [...results].map(([file, state]) => ({ file, state }));
}

/** JUnit-XML: `<testcase classname|file …>` с вложенными `<failure>`/`<error>`/`<skipped>`. */
export function parseJunit(text: string): TestResult[] {
  const results = new Map<string, TestState>();
  for (const match of text.matchAll(/<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g)) {
    const attrs = match[1] as string;
    const file = /\bfile="([^"]+)"/.exec(attrs)?.[1] ?? /\bclassname="([^"]+)"/.exec(attrs)?.[1];
    if (!file) continue;
    const inner = (match[3] as string | undefined) ?? '';
    const state: TestState = /<(failure|error)\b/.test(inner) ? 'failed' : /<skipped\b/.test(inner) ? 'skipped' : 'passed';
    merge(results, file, state);
  }
  return [...results].map(([file, state]) => ({ file, state }));
}

/** Формат по содержимому: JSON — vitest/jest, XML — JUnit; не понять — пусто. */
export function parseTestReport(text: string): { format: 'json' | 'junit' | null; results: TestResult[] } {
  const head = text.trimStart();
  if (head.startsWith('{')) { const results = parseJsonReport(text); return { format: results.length ? 'json' : null, results }; }
  if (head.startsWith('<')) { const results = parseJunit(text); return { format: results.length ? 'junit' : null, results }; }
  return { format: null, results: [] };
}

/**
 * Итог по проверкам из отчёта: проверка получает итог файла, на который ссылается её команда.
 * Файл в отчёте записан своим путём (абсолютным, относительным или как класс) — сравниваем по хвосту пути.
 */
export function verificationsFromReport(results: readonly TestResult[], checks: readonly { id: string; files: readonly string[] }[]): { verifications: Record<string, TestState>; unmatched: string[] } {
  const verifications: Record<string, TestState> = {};
  const used = new Set<string>();
  for (const check of checks) {
    let state: TestState | null = null;
    for (const file of check.files) {
      for (const result of results) {
        const tail = result.file.replace(/\\/g, '/');
        if (tail === file || tail.endsWith(`/${file}`)) { state = state ? worse(state, result.state) : result.state; used.add(result.file); }
      }
    }
    if (state) verifications[check.id] = state;
  }
  return { verifications, unmatched: results.filter((item) => !used.has(item.file)).map((item) => item.file) };
}
