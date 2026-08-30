import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';

import { analyze, type SourceFile } from '../server/lib/analyze';
import { coerceDates } from '../server/lib/parse';
import { validateProject, validateReport } from '../server/lib/schema';
import type { ProjectManifest, Report, SectionKey } from '../server/lib/types';

/**
 * Критерий закрытия фазы 1: на наборе файлов-примеров получается ожидаемый
 * список нарушений. Файловая система здесь есть только у теста — ядру
 * содержимое передаётся строками.
 */

const root = fileURLToPath(new URL('./fixtures/example-project/', import.meta.url));
const development = join(root, 'docs', 'development');

const manifest = readManifest();
const files = readRecords();
const reports = readReports();
const codeFiles = walk(join(root, 'app', 'src')).map(toProjectPath);

const result = analyze({
  files,
  manifest,
  reports,
  codeFiles,
  now: new Date('2026-08-30T12:00:00Z')
});

/** Пара «код + запись»: сравнивается весь список целиком, а не отдельные строки. */
const actual = result.violations
  .map((item) => `${item.code} ${item.id ?? item.path}`)
  .sort();

const expected = [
  'code_link_missing D-0003',
  'doc_changed_after_task T-0007',
  'id_duplicate T-0010',
  'id_duplicate T-0010',
  'id_mismatch R-0010',
  'link_broken T-0003',
  'link_cycle T-0004',
  'link_wrong_type T-0011',
  'parse_failed docs/development/design/D-9998-broken.md',
  'requirement_unimplemented R-0002',
  'requirement_unverified R-0002',
  'schema_invalid D-0009',
  'superseded_without_successor R-0003',
  'task_done_unverified T-0006',
  'task_no_requirement T-0012',
  'task_not_ready_docs T-0002',
  'task_stale T-0002',
  'title_mismatch T-0008',
  'unknown_type A-0009',
  'verification_never_run V-0003'
].sort();

describe('набор файлов-примеров', () => {
  it('манифест и отчёт проходят свои схемы', () => {
    expect(validateProject(manifest)).toEqual([]);
    for (const report of reports) expect(validateReport(report)).toEqual([]);
  });

  it('даёт ожидаемый список нарушений', () => {
    expect(actual).toEqual(expected);
  });

  it('покрывает все коды, которые виден общим проходом', () => {
    // transition_forbidden отвечает на запрос действия, а не на состояние
    // набора записей, поэтому в этом списке его нет — он проверен в rules.spec.
    const covered = new Set(result.violations.map((item) => item.code));
    expect(covered.size).toBe(19);
    expect(covered.has('transition_forbidden')).toBe(false);
  });

  it('не останавливается на нечитаемом файле', () => {
    expect(result.records).toHaveLength(files.length - 1);
    expect(result.graph.byId.has('T-0001')).toBe(true);
  });

  it('каждое нарушение называет путь и объясняет, что делать', () => {
    for (const item of result.violations) {
      expect(item.path).not.toBe('');
      expect(item.message.length).toBeGreaterThan(20);
    }
  });

  it('незнакомый тип не удваивается ошибкой схемы', () => {
    const about = result.violations.filter((item) => item.id === 'A-0009');
    expect(about.map((item) => item.code)).toEqual(['unknown_type']);
  });

  it('чужой префикс не удваивается ошибкой схемы', () => {
    const about = result.violations.filter((item) => item.id === 'R-0010');
    expect(about.map((item) => item.code)).toEqual(['id_mismatch']);
  });
});

function readManifest(): ProjectManifest {
  const raw = coerceDates(load(readFileSync(join(development, 'project.yaml'), 'utf8')));
  return raw as ProjectManifest;
}

function readRecords(): SourceFile[] {
  const sections = new Map<string, SectionKey>();
  for (const [key, folder] of Object.entries(manifest.paths)) {
    if (folder) sections.set(folder, key as SectionKey);
  }

  return walk(development)
    .filter((path) => path.endsWith('.md'))
    .map((path) => {
      const insideDevelopment = relative(development, path).split(/[\\/]/);
      const folder = insideDevelopment[0];
      const section = folder ? sections.get(folder) : undefined;
      return {
        text: readFileSync(path, 'utf8'),
        source: section ? { path: toProjectPath(path), section } : { path: toProjectPath(path) }
      };
    })
    .sort((a, b) => a.source.path.localeCompare(b.source.path));
}

function readReports(): Report[] {
  const folder = join(development, 'tests', 'reports');
  return walk(folder)
    .filter((path) => path.endsWith('.json'))
    .map((path) => JSON.parse(readFileSync(path, 'utf8')) as Report);
}

function walk(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) found.push(...walk(path));
    else found.push(path);
  }
  return found;
}

/** Пути в записях — относительно корня проекта и всегда через прямой слеш. */
function toProjectPath(path: string): string {
  return relative(root, path).split('\\').join('/');
}
