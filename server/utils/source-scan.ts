import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { normalizeRoot, resolveInside } from '../lib/paths';
import { detectSources, mergeSourceList, newFolders, type FolderFinding, type SourceFindings, type SourceKind } from '../lib/source-detect';
import { developmentDir, invalidateWorkspace, MANIFEST_FILE, readManifest } from '../lib/workspace';

/**
 * Обход проекта для автопоиска источников (R-0077): неглубокий и ограниченный —
 * проект на сотни тысяч файлов не должен вешать экран. Служебное (`.git`,
 * `node_modules`, сборка) не заходит в обход вовсе.
 */

const SKIP = new Set(['.git', 'node_modules', 'dist', 'build', 'out', '.nuxt', '.output', '.next', '.docdd', 'venv', '.venv', '__pycache__', 'target', 'vendor', 'coverage', '.idea', '.vscode']);
const MAX_DEPTH = 5;
const MAX_FILES = 30_000;

export function listProjectFiles(root: string): string[] {
  const base = normalizeRoot(root);
  const found: string[] = [];
  const walk = (relative: string, depth: number) => {
    if (found.length >= MAX_FILES || depth > MAX_DEPTH) return;
    let entries;
    try { entries = readdirSync(join(base, relative), { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (SKIP.has(entry.name)) continue;
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path, depth + 1);
      else if (entry.isFile()) found.push(path);
      if (found.length >= MAX_FILES) return;
    }
  };
  walk('', 0);
  return found;
}

export interface SourceReport extends SourceFindings {
  /** Из найденных папок — те, что ещё не названы в `sources`. */
  fresh: FolderFinding[];
  named: { code: string[]; client: string[]; docs: string[]; tests: string[] };
}

export function detectProjectSources(root: string): SourceReport {
  const found = detectSources(listProjectFiles(root));
  const sources = readManifest(root).sources as { code?: string[]; client?: string[]; docs?: string[]; tests?: string[] } | undefined;
  const named = { code: sources?.code ?? [], client: sources?.client ?? [], docs: sources?.docs ?? [], tests: sources?.tests ?? [] };
  return { ...found, fresh: newFolders(found.folders, named), named };
}

export type ApplyOutcome = { ok: true; added: Record<string, string[]> } | { ok: false; code: string; message: string };

/** Записывает подтверждённые человеком папки в `project.yaml`; путь вне корня — исключение, не папка — отказ. */
export function applySources(root: string, picks: readonly { kind: SourceKind; path: string }[]): ApplyOutcome {
  const base = normalizeRoot(root);
  const file = join(developmentDir(base), MANIFEST_FILE);
  let text = readFileSync(file, 'utf8');
  const added: Record<string, string[]> = {};
  for (const kind of ['code', 'client', 'docs', 'tests'] as const) {
    const paths = picks.filter((item) => item.kind === kind).map((item) => item.path.replace(/\/+$/, ''));
    if (paths.length === 0) continue;
    for (const path of paths) {
      const absolute = resolveInside(base, path);
      if (!existsSync(absolute)) return { ok: false, code: 'path_not_found', message: `Папки \`${path}\` нет` };
    }
    const edit = mergeSourceList(text, kind, paths);
    if (!edit.ok) return { ok: false, code: 'manifest_unsupported', message: edit.message };
    text = edit.text;
    if (edit.added.length) added[kind] = edit.added;
  }
  if (Object.keys(added).length) {
    writeFileSync(file, text, 'utf8');
    invalidateWorkspace(base);
  }
  return { ok: true, added };
}
