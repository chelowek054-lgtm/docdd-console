import { DEFAULT_ENTRIES, languageOf, normalizePath } from '../architecture';
import type { CodemapPart } from '../maps';
import { violation, type ArchitectureConfig, type MapsManifest, type Violation } from '../types';

/** Считаем файл у ближайшего каталога-модуля, включая модули с явным путём в карте. */
export function codebaseWarnings(
  modules: NonNullable<CodemapPart['modules']>, files: ReadonlySet<string>,
  thresholds: MapsManifest['thresholds'] = {}, entries: ArchitectureConfig['entries'] = {},
  readSource?: (path: string) => string | null
): Violation[] {
  const result: Violation[] = [];
  const dirs = new Map<string, { files: number; lines: number }>();
  const children = new Map<string, Set<string>>();
  const parent = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf('/')));
  const ownDir = (dir: string) => dirs.set(dir, { files: 0, lines: 0 });
  for (const node of modules) {
    if (!node.summary?.trim()) result.push(violation('module_purpose_missing', node.declaredBy ?? null, node.path ?? node.id, `У модуля ${node.id} не указано назначение (summary).`));
    if (node.path && !files.has(node.path)) ownDir(normalizePath(node.path));
  }
  for (const file of files) {
    const language = languageOf(file);
    const name = file.slice(file.lastIndexOf('/') + 1);
    const entry = language ? entries[language] ?? DEFAULT_ENTRIES[language] ?? [] : [];
    if (entry.includes(name) || entry.includes('*')) ownDir(parent(file));
    for (let child = file; child; child = parent(child)) {
      const dir = parent(child);
      const names = children.get(dir) ?? new Set<string>();
      children.set(dir, names);
      if (names.has(child)) break;
      names.add(child);
    }
  }
  for (const file of files) {
    let dir = parent(file);
    while (dir && !dirs.has(dir)) dir = parent(dir);
    const owner = dirs.get(dir);
    if (!owner) continue;
    owner.files++;
    if (readSource && owner.lines <= (thresholds.moduleLines ?? 3000)) {
      const source = readSource(file);
      if (source && !source.includes('\0')) owner.lines += (source.match(/\n/g)?.length ?? 0) + Number(!source.endsWith('\n'));
    }
  }
  for (const [dir, size] of dirs) {
    if (size.files > (thresholds.moduleFiles ?? 25) || size.lines > (thresholds.moduleLines ?? 3000)) {
      result.push(violation('module_too_large', null, dir || '.', `Модуль ${dir || '.'} превышает порог деления: ${size.files} файлов или более ${thresholds.moduleLines ?? 3000} строк.`));
    }
  }
  for (const [dir, names] of children) {
    if (names.size > (thresholds.folderEntries ?? 15)) result.push(violation('folder_too_large', null, dir || '.', `В каталоге ${names.size} элементов при пороге ${thresholds.folderEntries ?? 15}.`));
  }
  return result;
}
