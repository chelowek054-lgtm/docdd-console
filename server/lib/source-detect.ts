/**
 * Автопоиск источников проекта (R-0077, docs/04-ui.md, «Подключение»): по списку
 * путей файлов находит папки кода, клиента, документации и тестов; файлы
 * контрактов, зависимостей и отчётов CI. Чистые функции над строками: обход
 * диска — в `server/utils/source-scan.ts`. Находка — предложение: человек
 * подтверждает, и только тогда она попадает в `project.yaml`.
 */

const CODE_EXT = new Set(['ts', 'js', 'mjs', 'cjs', 'py', 'go', 'rs', 'java', 'kt', 'cs', 'rb', 'php', 'gd', 'cpp', 'cc', 'c', 'h', 'swift', 'scala', 'ex', 'exs', 'dart']);
const UI_EXT = new Set(['vue', 'tsx', 'jsx', 'svelte', 'html', 'css', 'scss', 'dart', 'swift']);
const DOC_EXT = new Set(['md', 'mdx', 'rst', 'adoc']);

/** Контейнеры монорепозитория: код ищем на уровень глубже. */
const MONOREPO = new Set(['packages', 'apps', 'services', 'libs', 'modules', 'projects']);
const TEST_DIRS = new Set(['test', 'tests', '__tests__', 'spec', 'specs', 'e2e', 'cypress', 'playwright']);
const DOC_DIRS = new Set(['docs', 'doc', 'documentation', 'wiki', 'adr']);
/** Не источники: сборка, зависимости, служебное самого проекта. */
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'out', '.git', '.nuxt', '.output', '.next', '.docdd', 'venv', '.venv', '__pycache__', 'target', 'vendor', 'coverage', 'public', 'static', 'assets', 'scripts', 'tools', 'bin', 'obj', '.github', '.vscode', '.idea']);

export type SourceKind = 'code' | 'client' | 'docs' | 'tests';

export interface FolderFinding {
  kind: SourceKind;
  /** Папка от корня проекта, через прямой слеш. */
  path: string;
  /** Сколько подходящих файлов в ней. */
  files: number;
  /** Почему предложена: человеку проще подтвердить, когда видно причину. */
  why: string;
}

export interface FileFinding {
  kind: 'contract' | 'dependencies' | 'ci_report';
  path: string;
  /** Что за файл: `openapi`, `proto`, `json-schema`, `npm`, `pip`, `junit`… */
  format: string;
}

export interface SourceFindings {
  folders: FolderFinding[];
  files: FileFinding[];
}

const extOf = (path: string): string => /\.([A-Za-z0-9]+)$/.exec(path)?.[1]?.toLowerCase() ?? '';
const baseOf = (path: string): string => path.split('/').pop() ?? path;

/** Что за файл контракта по имени; не контракт — `null`. */
export function contractFormat(path: string): string | null {
  const name = baseOf(path).toLowerCase();
  if (/^(openapi|swagger)[\w.-]*\.(ya?ml|json)$/.test(name)) return 'openapi';
  if (name.endsWith('.proto')) return 'proto';
  if (name.endsWith('.schema.json')) return 'json-schema';
  if (name.endsWith('.graphql') || name.endsWith('.gql')) return 'graphql';
  if (/^asyncapi[\w.-]*\.(ya?ml|json)$/.test(name)) return 'asyncapi';
  return null;
}

const DEPENDENCY_FILES: Record<string, string> = {
  'package.json': 'npm', 'requirements.txt': 'pip', 'pyproject.toml': 'python', 'go.mod': 'go', 'cargo.toml': 'cargo',
  'pom.xml': 'maven', 'build.gradle': 'gradle', 'build.gradle.kts': 'gradle', 'composer.json': 'composer', 'gemfile': 'bundler', 'pubspec.yaml': 'pub'
};

/** Файл зависимостей по имени; `.csproj` — .NET. */
export function dependencyFormat(path: string): string | null {
  const name = baseOf(path).toLowerCase();
  if (name.endsWith('.csproj')) return 'nuget';
  return DEPENDENCY_FILES[name] ?? null;
}

/** Отчёт CI: JUnit-XML, vitest/jest JSON-отчёты, lcov. */
export function ciReportFormat(path: string): string | null {
  const name = baseOf(path).toLowerCase();
  if (/^(junit|test-?results?|results?)[\w.-]*\.xml$/.test(name)) return 'junit';
  if (name === 'lcov.info') return 'lcov';
  if (/(^|\/)(test-?results?|reports?)\/[^/]+\.json$/.test(path.toLowerCase()) && !/docs\/development\//.test(path)) return 'json-report';
  return null;
}

interface Tally { code: number; ui: number; docs: number; tests: number }

function emptyTally(): Tally {
  return { code: 0, ui: 0, docs: 0, tests: 0 };
}

const isTestFile = (path: string) => /(^|\/)(test_[^/]+\.py|[^/]+_test\.(go|py)|[^/]+\.(spec|test)\.[a-z]+)$/.test(path);

/**
 * Корни кандидатов: папка первого уровня; под контейнерами монорепозитория
 * (`packages/*`) — папка второго. Файл в корне проекта папки не даёт.
 */
function rootOf(path: string): string | null {
  const parts = path.split('/');
  if (parts.length < 2) return null;
  const first = parts[0] as string;
  if (SKIP_DIRS.has(first)) return null;
  if (MONOREPO.has(first) && parts.length >= 3) return `${first}/${parts[1]}`;
  return first;
}

/** Предложения по списку путей файлов проекта (от корня, через прямой слеш). */
export function detectSources(paths: readonly string[]): SourceFindings {
  const tally = new Map<string, Tally>();
  const files: FileFinding[] = [];

  for (const path of paths) {
    const contract = contractFormat(path);
    if (contract) files.push({ kind: 'contract', path, format: contract });
    const dependency = dependencyFormat(path);
    // Зависимости ищем у корня и у корней монорепозитория, а не в каждой вложенной папке.
    if (dependency && path.split('/').length <= 3 && !path.split('/').some((part) => SKIP_DIRS.has(part))) files.push({ kind: 'dependencies', path, format: dependency });
    const report = ciReportFormat(path);
    if (report) files.push({ kind: 'ci_report', path, format: report });

    // Записи процесса и входящее — не источники документации (docs/development, docs/inbox).
    if (path.startsWith('docs/development/') || path.startsWith('docs/inbox/')) continue;
    const root = rootOf(path);
    if (!root) continue;
    const row = tally.get(root) ?? emptyTally();
    const ext = extOf(path);
    if (isTestFile(path) || path.split('/').some((part) => TEST_DIRS.has(part))) row.tests += 1;
    else if (DOC_EXT.has(ext)) row.docs += 1;
    else if (UI_EXT.has(ext)) row.ui += 1;
    else if (CODE_EXT.has(ext)) row.code += 1;
    tally.set(root, row);
  }

  const folders: FolderFinding[] = [];
  for (const [path, row] of [...tally.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const name = path.split('/').pop() as string;
    if (DOC_DIRS.has(name) || (row.docs >= 2 && row.code + row.ui === 0)) {
      if (row.docs > 0 && path !== 'docs/development') folders.push({ kind: 'docs', path, files: row.docs, why: `документов: ${row.docs}` });
      continue;
    }
    if (TEST_DIRS.has(name) || (row.tests > 0 && row.code + row.ui === 0)) {
      folders.push({ kind: 'tests', path, files: row.tests, why: `тестовых файлов: ${row.tests}` });
      continue;
    }
    // Клиент: интерфейсных файлов не меньше, чем кода, или папка названа клиентской.
    if (row.ui >= 3 && row.ui >= row.code) folders.push({ kind: 'client', path, files: row.ui, why: `файлов интерфейса: ${row.ui}` });
    else if (row.code >= 3) folders.push({ kind: 'code', path, files: row.code, why: `файлов кода: ${row.code}` });
    // Тесты рядом с кодом (`*.spec.ts` внутри `server/`) — отдельное предложение не нужно, но тестовая папка корня — нужна.
  }

  // Тестовые файлы, лежащие рядом с кодом, — одна находка «тесты» на их общую папку первого уровня.
  const colocated = [...tally.entries()].filter(([path, row]) => row.tests > 0 && !folders.some((item) => item.kind === 'tests' && item.path === path) && (row.code > 0 || row.ui > 0));
  for (const [path, row] of colocated) folders.push({ kind: 'tests', path, files: row.tests, why: `тестовых файлов рядом с кодом: ${row.tests}` });

  // Прочие находки-файлы не дублируем и держим стабильный порядок.
  const seen = new Set<string>();
  const unique = files.filter((item) => (seen.has(`${item.kind}:${item.path}`) ? false : seen.add(`${item.kind}:${item.path}`)));
  return { folders, files: unique.sort((a, b) => a.kind.localeCompare(b.kind) || a.path.localeCompare(b.path)) };
}

/** Что уже названо в манифесте, и что из найденного ещё не названо. */
export function newFolders(found: readonly FolderFinding[], named: { code?: readonly string[]; client?: readonly string[]; docs?: readonly string[]; tests?: readonly string[] }): FolderFinding[] {
  const has = (kind: SourceKind, path: string) => (named[kind] ?? []).some((item) => item.replace(/\/+$/, '') === path);
  return found.filter((item) => !has(item.kind, item.path));
}

/**
 * Правка `sources.<ключ>` в тексте манифеста: объединяет с названным (ничего
 * не убирает), пишет строкой `[a, b]`; ключа нет — вставляет под `sources:`.
 * Комментарии и прочее остаются на месте (docs/02-workspace-contract.md).
 */
export function mergeSourceList(manifestText: string, key: SourceKind | 'inbox', add: readonly string[]): { ok: true; text: string; added: string[] } | { ok: false; message: string } {
  const eol = manifestText.includes('\r\n') ? '\r\n' : '\n';
  const lines = manifestText.split(/\r?\n/);
  const head = lines.findIndex((line) => /^sources:\s*$/.test(line));
  if (head === -1) return { ok: false, message: 'В project.yaml нет секции `sources:` — добавьте её руками один раз.' };
  let end = lines.length;
  for (let at = head + 1; at < lines.length; at += 1) if (/^\S/.test(lines[at] as string)) { end = at; break; }
  const row = lines.findIndex((line, at) => at > head && at < end && new RegExp(`^\\s+${key}:`).test(line));
  const unquote = (value: string) => value.trim().replace(/^['"]|['"]$/g, '');
  const current: string[] = [];
  if (row !== -1) {
    const value = (lines[row] as string).replace(new RegExp(`^\\s+${key}:\\s*`), '').replace(/\s+#.*$/, '');
    if (/^\[.*\]$/.test(value.trim())) current.push(...value.trim().slice(1, -1).split(',').map(unquote).filter(Boolean));
    else if (value.trim() !== '') return { ok: false, message: `sources.${key} записан не списком в одну строку — поправьте руками один раз.` };
    else if (/^\s+-\s/.test(lines[row + 1] ?? '')) return { ok: false, message: `sources.${key} записан блочным списком — поправьте руками один раз: приложение пишет списки в одну строку.` };
  }
  const added = add.filter((item) => !current.includes(item));
  if (added.length === 0) return { ok: true, text: manifestText, added: [] };
  const merged = `  ${key}: [${[...current, ...added].join(', ')}]`;
  if (row !== -1) lines[row] = merged;
  else lines.splice(head + 1, 0, merged);
  return { ok: true, text: lines.join(eol), added };
}
