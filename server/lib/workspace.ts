import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { load } from 'js-yaml';

import type { SourceFile } from './analyze';
import { isIgnored, parseGitignore } from './ignore';
import { coerceDates } from './parse';
import { normalizeRoot, resolveInside, toProjectPath } from './paths';
import { validateProject, validateReport } from './schema';
import type { ProjectManifest, Report, SectionKey } from './types';

/**
 * Чтение проекта с диска. Всё, что читается здесь, дальше передаётся ядру
 * строками и объектами: разбор и правила о файловой системе не знают.
 */

export const DEVELOPMENT_DIR = 'docs/development';
export const MANIFEST_FILE = 'project.yaml';

export class WorkspaceError extends Error {
  constructor(readonly code: string, message: string, readonly detail?: string) {
    super(message);
    this.name = 'WorkspaceError';
  }
}

export interface Workspace {
  root: string;
  manifest: ProjectManifest;
  files: SourceFile[];
  reports: Report[];
  codeFiles: string[];
  /** Отпечаток состояния файлов: по нему решается, устарел ли кэш. */
  fingerprint: string;
}

export function developmentDir(root: string): string {
  return join(normalizeRoot(root), 'docs', 'development');
}

export function hasWorkspace(root: string): boolean {
  return existsSync(join(developmentDir(root), MANIFEST_FILE));
}

/**
 * Манифест читается до всего остального, и поколение контракта — до манифеста:
 * `docdd.workspace/2` это отказ с понятной причиной, а не попытка прочитать
 * половину (docs/02-workspace-contract.md).
 */
export function readManifest(root: string): ProjectManifest {
  const path = join(developmentDir(root), MANIFEST_FILE);
  if (!existsSync(path)) {
    throw new WorkspaceError(
      'project_not_found',
      `В указанной папке нет ${DEVELOPMENT_DIR}/${MANIFEST_FILE}`,
      normalizeRoot(root)
    );
  }

  let raw: unknown;
  try {
    raw = coerceDates(load(readFileSync(path, 'utf8')));
  } catch (error) {
    throw new WorkspaceError(
      'manifest_unreadable',
      `Манифест ${DEVELOPMENT_DIR}/${MANIFEST_FILE} не разбирается как YAML`,
      error instanceof Error ? error.message : String(error)
    );
  }

  const issues = validateProject(raw);
  if (issues.length > 0) {
    throw new WorkspaceError(
      'manifest_invalid',
      `Манифест проекта не проходит схему: ${issues[0]?.message ?? ''}`,
      issues.map((issue) => issue.message).join(' ')
    );
  }

  return raw as ProjectManifest;
}

/**
 * Чтение файла проекта для сверки свидетельств карт. Граница корня та же, что
 * у всего остального; файла нет — `null`, и это не исключение, а ответ.
 */
export function sourceReader(root: string): (path: string) => string | null {
  const normalized = normalizeRoot(root);
  return (path: string) => {
    try {
      return readFileSync(resolveInside(normalized, path), 'utf8');
    } catch {
      return null;
    }
  };
}

export function readWorkspace(root: string): Workspace {
  const normalized = normalizeRoot(root);
  const manifest = readManifest(normalized);
  const development = developmentDir(normalized);

  // Папки берутся из манифеста: имена разделов в код не зашиваются.
  const sections = new Map<string, SectionKey>();
  for (const [key, folder] of Object.entries(manifest.paths ?? {})) {
    if (typeof folder === 'string' && folder) sections.set(folder, key as SectionKey);
  }

  const parts: string[] = [];
  const files: SourceFile[] = [];
  for (const path of walk(development)) {
    if (!path.endsWith('.md')) continue;
    const projectPath = toProjectPath(normalized, path);
    const folder = projectPath.slice(`${DEVELOPMENT_DIR}/`.length).split('/')[0];
    const section = folder ? sections.get(folder) : undefined;
    files.push({
      text: cachedText(path),
      source: section ? { path: projectPath, section } : { path: projectPath }
    });
    parts.push(stamp(path, projectPath));
  }
  files.sort((a, b) => a.source.path.localeCompare(b.source.path));

  const reports: Report[] = [];
  const testsFolder = manifest.paths?.tests;
  if (testsFolder) {
    const reportsDir = join(development, testsFolder, 'reports');
    for (const path of walk(reportsDir)) {
      if (!path.endsWith('.json')) continue;
      parts.push(stamp(path, toProjectPath(normalized, path)));
      const report = readReport(path);
      if (report) reports.push(report);
    }
  }

  const codeFiles: string[] = [];
  for (const codeRoot of manifest.sources?.code ?? []) {
    for (const path of walkCodeCached(normalized, codeRoot)) {
      codeFiles.push(toProjectPath(normalized, path));
    }
  }
  // Имена файлов кода входят в отпечаток, а их содержимое — нет: ссылки
  // проверяются на существование файла, а не на то, что внутри.
  parts.push(...codeFiles);

  return {
    root: normalized,
    manifest,
    files,
    reports,
    codeFiles,
    fingerprint: fingerprintOf(parts)
  };
}

/**
 * Отчёт, не прошедший схему, молча пропускается: он производное, и негодный
 * отчёт не должен мешать увидеть состояние работы.
 */
function readReport(path: string): Report | null {
  try {
    const raw: unknown = JSON.parse(cachedText(path));
    return validateReport(raw).length === 0 ? (raw as Report) : null;
  } catch {
    return null;
  }
}

/** Всегда мимо описи, даже если про них никто не написал в `.gitignore`. */
const ALWAYS_IGNORED = ['.git/'];

function walk(directory: string, inherited: readonly string[] = []): string[] {
  if (!existsSync(directory)) return [];

  // `.gitignore` этой папки действует и в ней самой, и глубже — так же, как
  // у настоящего git; более глубокий не отменяет более мелкий, а добавляется.
  const own = readGitignore(directory);
  const rules = own.length > 0 ? [...inherited, ...own] : inherited;

  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (isIgnored(ALWAYS_IGNORED, entry.name, entry.isDirectory())) continue;
    if (isIgnored(rules, entry.name, entry.isDirectory())) continue;

    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...walk(path, rules));
    else if (entry.isFile()) found.push(path);
  }
  return found.sort();
}

function readGitignore(directory: string): string[] {
  const path = join(directory, '.gitignore');
  try {
    return parseGitignore(readFileSync(path, 'utf8'));
  } catch {
    return [];
  }
}

function stamp(path: string, projectPath: string): string {
  const info = statSync(path);
  return `${projectPath}:${info.mtimeMs}:${info.size}`;
}

/**
 * Отпечаток — не криптография, а способ заметить правку. Кэш производный,
 * ошибиться в сторону лишней пересборки безопасно.
 */
function fingerprintOf(parts: readonly string[]): string {
  let hash = 0x811c9dc5;
  for (const part of parts.join('\n')) {
    hash ^= part.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0') + ':' + parts.length;
}

/**
 * Кэш в памяти процесса. Он производный: ключ файла — путь, mtime и размер,
 * любое расхождение значит «читаем заново»; при сомнении тоже перечитываем.
 * Размер ограничен, чтобы долгоживущий сервер не рос вместе с проектом.
 */
const TEXT_CACHE_LIMIT = 4000;
const textCache = new Map<string, { mtimeMs: number; size: number; text: string }>();

function cachedText(path: string): string {
  const info = statSync(path);
  const hit = textCache.get(path);
  if (hit && hit.mtimeMs === info.mtimeMs && hit.size === info.size) return hit.text;

  const text = readFileSync(path, 'utf8');
  textCache.delete(path);
  textCache.set(path, { mtimeMs: info.mtimeMs, size: info.size, text });
  // Map помнит порядок вставки: выбрасываем самые давние.
  while (textCache.size > TEXT_CACHE_LIMIT) {
    const oldest = textCache.keys().next().value;
    if (oldest === undefined) break;
    textCache.delete(oldest);
  }
  return text;
}

/**
 * Обход дерева кода — самое дорогое при смене статуса, а менять его в эти
 * секунды некому: файлы кода пишет модель в своей ветке, не это действие.
 */
const CODE_WALK_TTL_MS = 2000;
const codeWalks = new Map<string, { at: number; paths: string[] }>();

function walkCodeCached(root: string, codeRoot: string): string[] {
  const key = `${root} ${codeRoot}`;
  const hit = codeWalks.get(key);
  if (hit && Date.now() - hit.at < CODE_WALK_TTL_MS) return hit.paths;
  const paths = walk(join(root, codeRoot));
  codeWalks.set(key, { at: Date.now(), paths });
  return paths;
}

const invalidators: Array<(root: string) => void> = [];

/** Другие производные кэши (ветки работы) подписываются на сброс корня. */
export function onWorkspaceInvalidated(listener: (root: string) => void): void {
  invalidators.push(listener);
}

/** Запись изменила проект: обход кода и производные от него кэши забываются. */
export function invalidateWorkspace(root: string): void {
  const normalized = normalizeRoot(root);
  for (const key of [...codeWalks.keys()]) {
    if (key.startsWith(`${normalized} `)) codeWalks.delete(key);
  }
  for (const listener of invalidators) listener(normalized);
}

/**
 * Дешёвый отпечаток для кэша ответов в памяти (`server/utils/memo.ts`): те же
 * файлы, что обходит `readWorkspace`, но только по `stat` — без чтения и
 * разбора. Строже `Workspace.fingerprint`: в него входят манифест и время/размер
 * файлов кода, потому что сверка свидетельств карт читает их содержимое.
 * Ошибиться в сторону лишней пересборки безопасно.
 */
export function fingerprintOnly(root: string): string {
  const normalized = normalizeRoot(root);
  const manifest = readManifest(normalized);
  const development = developmentDir(normalized);

  const parts: string[] = [stamp(join(development, MANIFEST_FILE), MANIFEST_FILE)];
  for (const path of walk(development)) {
    if (path.endsWith('.md')) parts.push(stamp(path, toProjectPath(normalized, path)));
  }
  const testsFolder = manifest.paths?.tests;
  if (testsFolder) {
    for (const path of walk(join(development, testsFolder, 'reports'))) {
      if (path.endsWith('.json')) parts.push(stamp(path, toProjectPath(normalized, path)));
    }
  }
  for (const codeRoot of manifest.sources?.code ?? []) {
    for (const path of walk(join(normalized, codeRoot))) {
      parts.push(stamp(path, toProjectPath(normalized, path)));
    }
  }
  return fingerprintOf(parts);
}
