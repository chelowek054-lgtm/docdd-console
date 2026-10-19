import { withBuiltin } from '../lib/builtin';
import { normalizeRoot } from '../lib/paths';
import { fingerprintOnly, readManifest } from '../lib/workspace';
import { sourceRoot } from './source-root';

/**
 * Память процесса для тяжёлых производных ответов (T-0102, R-0041): карта,
 * правила, справочник и дизайн каждый раз заново читали весь проект. Это кэш
 * производного (ADR-0001): пропал вместе с процессом — ничего не потеряно, а
 * источник правды остаётся в файлах. Отдаётся, пока совпадает отпечаток.
 */

/** Ключей не больше: проектов у человека единицы, но память не должна расти без границ. */
const MAX_KEYS = 50;

interface Entry {
  fingerprint: string;
  value: unknown;
}

const entries = new Map<string, Entry>();

/**
 * Ошибка `fingerprintFn` или `compute` уходит вызывающему как есть и не
 * запоминается: маршрут сам превращает её в тот же ответ, что и раньше.
 */
export function memoByFingerprint<T>(
  root: string,
  key: string,
  fingerprintFn: () => string,
  compute: () => T
): T {
  const fingerprint = fingerprintFn();
  const id = `${normalizeRoot(root)}\u0000${key}`;
  const hit = entries.get(id);
  if (hit && hit.fingerprint === fingerprint) {
    // Свежее обращение уходит в конец порядка вставки — вытесняется самое давнее.
    entries.delete(id);
    entries.set(id, hit);
    return hit.value as T;
  }

  const value = compute();
  entries.delete(id);
  entries.set(id, { fingerprint, value });
  while (entries.size > MAX_KEYS) {
    const oldest = entries.keys().next().value;
    if (oldest === undefined) break;
    entries.delete(oldest);
  }
  return value;
}

/** Отпечаток одного проекта без общих источников — для ответов, что от них не зависят (карта). */
export function fingerprintProject(root: string): string {
  return fingerprintOnly(root);
}

/**
 * Отпечаток проекта вместе с общими источниками практик и справки
 * (`sources.shared` и встроенный набор): правила, дизайн и справочник зависят
 * и от них. Источник, который не открылся, даёт свою метку — исчезновение или
 * появление источника тоже меняет отпечаток.
 */
export function fingerprintWithSources(root: string): string {
  const parts = [fingerprintOnly(root)];
  for (const source of withBuiltin(readManifest(normalizeRoot(root)).sources?.shared ?? [])) {
    try {
      parts.push(`${source.path}=${fingerprintOnly(sourceRoot(source.path))}`);
    } catch {
      parts.push(`${source.path}=unavailable`);
    }
  }
  return parts.join('|');
}
