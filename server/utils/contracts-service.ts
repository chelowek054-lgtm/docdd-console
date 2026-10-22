import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { analyze } from '../lib/analyze';
import { contractRecords, mergeGlossary, parseDependencies, referenceRecords, referencedPaths, termsFromDocs } from '../lib/contracts-import';
import { dropCache } from '../lib/cache';
import { normalizeRoot, resolveInside } from '../lib/paths';
import { detectSources, type FileFinding } from '../lib/source-detect';
import { readWorkspace, sourceReader } from '../lib/workspace';

import { createRecords } from './inbox-service';
import { listProjectFiles } from './source-scan';
import { today } from './record-write';

/**
 * Контракты, справки и глоссарий из кода и документации (R-0080): шаги подключения.
 * Читают файлы проекта, ничего не перетирают, всё приходит черновиками с указанием источника.
 */

const MAX_FILE = 512 * 1024;
const MAX_DOCS = 200;
const OUT = new Set(['superseded', 'rejected', 'dropped']);

function records(root: string) {
  const workspace = readWorkspace(root);
  return analyze({ files: workspace.files, manifest: workspace.manifest, reports: workspace.reports, codeFiles: workspace.codeFiles }).records.filter((record) => !OUT.has(record.status));
}

/** Чтение файла проекта не больше предела; больше или нет — `null`. */
function reader(root: string): (path: string) => string | null {
  const read = sourceReader(root);
  return (path) => {
    try { if (statSync(resolveInside(root, path)).size > MAX_FILE) return null; } catch { return null; }
    return read(path);
  };
}

export interface StepOutcome { ok: boolean; created: number; summary: string }

export function importContracts(root: string): StepOutcome {
  const base = normalizeRoot(root);
  const found = detectSources(listProjectFiles(base).filter((path) => !path.startsWith('docs/development/')));
  const { records: proposed, skipped } = contractRecords(found.files, reader(base), referencedPaths(records(base)));
  const total = found.files.filter((file) => file.kind === 'contract').length;
  if (proposed.length === 0) return { ok: true, created: 0, summary: total === 0 ? 'файлов контрактов (OpenAPI, proto, JSON-схем) не найдено' : `новых контрактов нет${skipped.length ? `; не прочитано: ${skipped.length}` : ''}` };
  const made = createRecords(base, proposed, []);
  if (!made.ok) return { ok: false, created: 0, summary: made.message };
  return { ok: true, created: made.created.length, summary: `заведено контрактов-черновиков: ${made.created.length}${skipped.length ? `; не прочитано: ${skipped.length}` : ''} — подтвердите, что это действующие контракты` };
}

export function importReferences(root: string): StepOutcome {
  const base = normalizeRoot(root);
  const found = detectSources(listProjectFiles(base).filter((path) => !path.startsWith('docs/development/')));
  const files = found.files.filter((file): file is FileFinding => file.kind === 'dependencies');
  if (files.length === 0) return { ok: true, created: 0, summary: 'файла зависимостей не найдено' };
  const read = reader(base);
  const existing = new Set(records(base).filter((record) => record.type === 'reference').map((record) => record.title.toLowerCase()));
  const proposed = [];
  let left = 0;
  for (const file of files) {
    const text = read(file.path);
    if (text === null) continue;
    const out = referenceRecords(file, parseDependencies(file.format, text), existing, today());
    // Названия внутри одного захода не повторяются между файлами (корень и пакеты монорепозитория).
    for (const record of out.records) { existing.add(record.title.toLowerCase()); proposed.push({ ...record, key: `ref${proposed.length + 1}` }); }
    left += out.left;
  }
  if (proposed.length === 0) return { ok: true, created: 0, summary: 'новых справок нет: зависимости уже описаны' };
  const made = createRecords(base, proposed, []);
  if (!made.ok) return { ok: false, created: 0, summary: made.message };
  return { ok: true, created: made.created.length, summary: `заведено справок-черновиков: ${made.created.length}${left ? `; ещё ${left} — повторите шаг` : ''}; назначение допишите` };
}

export function importGlossary(root: string): StepOutcome {
  const base = normalizeRoot(root);
  const manifest = readWorkspace(base).manifest;
  const docsDirs = (manifest.sources?.docs ?? []).map((dir) => dir.replace(/\/+$/, ''));
  const paths = listProjectFiles(base).filter((path) => /\.mdx?$/i.test(path) && !path.startsWith('docs/development/') && !path.startsWith('docs/inbox/')
    && (/^README\.md$/i.test(path) || docsDirs.some((dir) => path === dir || path.startsWith(`${dir}/`))));
  const read = reader(base);
  const docs = paths.slice(0, MAX_DOCS).flatMap((path) => { const text = read(path); return text === null ? [] : [{ path, text }]; });
  const file = resolveInside(base, 'docs/development/glossary.md');
  const existing = existsSync(file) ? readFileSync(file, 'utf8') : null;
  const merged = mergeGlossary(existing, termsFromDocs(docs), manifest.project.name ?? manifest.project.id);
  if (merged.added === 0) return { ok: true, created: 0, summary: docs.length === 0 ? 'документации для поиска терминов не найдено (названа ли sources.docs?)' : 'новых терминов в документации нет' };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, merged.text, 'utf8');
  dropCache(base);
  return { ok: true, created: merged.added, summary: `дописано терминов в glossary.md: ${merged.added} — раздел «Из документации», проверьте определения` };
}
