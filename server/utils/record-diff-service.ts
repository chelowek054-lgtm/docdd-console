import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { diffRecordTexts, type RecordDiff } from '../lib/record-diff';
import { parseMapRecord } from '../lib/maps';
import { parseRecord } from '../lib/parse';
import { normalizeRoot, resolveInside } from '../lib/paths';
import { git, isRepository } from './git';
import { loadIndex } from './index-service';

/**
 * «Что меняется» для записи на подтверждении. «Было» берётся из git, своей базы
 * снимков нет; отметка просмотра — производный файл в `.docdd/`, его потеря
 * только возвращает значок «разница не открывалась».
 */

const VIEWED_FILE = 'diff-viewed.json';

const hashOf = (text: string) => createHash('sha1').update(text).digest('hex');

function viewedPath(root: string): string {
  return join(normalizeRoot(root), '.docdd', VIEWED_FILE);
}

function readViewed(root: string): Record<string, string> {
  try {
    return existsSync(viewedPath(root)) ? (JSON.parse(readFileSync(viewedPath(root), 'utf8')) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Отметка привязана к хэшу файла: правка после просмотра обнуляет её. */
export function markViewed(root: string, recordId: string, path: string): void {
  const text = readFileSync(resolveInside(root, path), 'utf8');
  const marks = readViewed(root);
  marks[recordId] = hashOf(text);
  mkdirSync(dirname(viewedPath(root)), { recursive: true });
  writeFileSync(viewedPath(root), JSON.stringify(marks, null, 2));
}

export function wasViewed(root: string, recordId: string, path: string): boolean {
  try {
    return readViewed(root)[recordId] === hashOf(readFileSync(resolveInside(root, path), 'utf8'));
  } catch {
    return false;
  }
}

/** Записи на подтверждении, чью разницу не открывали. */
export function unviewedReview(root: string): string[] {
  return loadIndex(root).records
    .filter((record) => record.status === 'review' && !wasViewed(root, record.id, record.path))
    .map((record) => record.id);
}

const statusOf = (text: string, path: string): string | null => {
  const parsed = parseRecord(text, { path });
  return parsed.ok ? String(parsed.record.data['status'] ?? '') : null;
};

/**
 * Версия-«было»: файл на последнем коммите со статусом approved, иначе на
 * предыдущем коммите (тот, что не совпадает с рабочим файлом).
 */
async function baseVersion(
  root: string,
  path: string,
  current: string
): Promise<{ text: string; commit: string; reason: 'approved' | 'previous' } | null> {
  if (!(await isRepository(root))) return null;
  const log = await git(root, ['log', '--format=%H', '--', path]);
  const commits = log.ok ? log.stdout.split(/\r?\n/).filter(Boolean) : [];
  const versions: { commit: string; text: string }[] = [];
  for (const commit of commits.slice(0, 30)) {
    const shown = await git(root, ['show', `${commit}:${path}`]);
    if (shown.ok) versions.push({ commit, text: shown.stdout });
  }
  const approved = versions.find((item) => item.text !== current && statusOf(item.text, path) === 'approved');
  if (approved) return { ...approved, reason: 'approved' };
  const previous = versions.find((item) => item.text !== current);
  return previous ? { ...previous, reason: 'previous' } : null;
}

export async function recordDiff(root: string, recordId: string): Promise<(RecordDiff & { viewed: boolean }) | null> {
  const index = loadIndex(root);
  const record = index.records.find((item) => item.id === recordId);
  if (!record) return null;
  const current = readFileSync(resolveInside(root, record.path), 'utf8');
  const base = await baseVersion(root, record.path, current);

  // Возможности функциональной карты нужны только вектору: для остальных записей не читаем.
  const capabilities: { id: string; title?: string; summary?: string }[] = [];
  if (record.type === 'map') {
    for (const map of index.records.filter((item) => item.type === 'map' && item.status === 'approved')) {
      const parsed = parseRecord(readFileSync(resolveInside(root, map.path), 'utf8'), { path: map.path });
      if (parsed.ok) capabilities.push(...(parseMapRecord(parsed.record.body).change.functional?.added?.capabilities ?? []));
    }
  }

  const diff = diffRecordTexts(record.id, record.type, base?.text ?? null, current, capabilities);
  return {
    ...diff,
    base: base ? { commit: base.commit, reason: base.reason } : null,
    viewed: wasViewed(root, recordId, record.path)
  };
}
