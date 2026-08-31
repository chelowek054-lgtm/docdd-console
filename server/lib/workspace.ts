import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { load } from 'js-yaml';

import type { SourceFile } from './analyze';
import { coerceDates } from './parse';
import { normalizeRoot, toProjectPath } from './paths';
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
      text: readFileSync(path, 'utf8'),
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
    for (const path of walk(join(normalized, codeRoot))) {
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
    const raw: unknown = JSON.parse(readFileSync(path, 'utf8'));
    return validateReport(raw).length === 0 ? (raw as Report) : null;
  } catch {
    return null;
  }
}

function walk(directory: string): string[] {
  if (!existsSync(directory)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...walk(path));
    else if (entry.isFile()) found.push(path);
  }
  return found.sort();
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
