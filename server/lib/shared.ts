import type { IndexRecord } from './types';

/**
 * Общие практики между проектами (docs/11-shared-sources.md, docs/06-phases.md,
 * фаза 13). Источник — обычный DocDD-проект, читается тем же способом, что и
 * любой другой (`loadIndex`); здесь — только отбор, чистые функции над уже
 * построенным индексом источника.
 */

/** Из источника когда-либо покидают только эти два типа — не договорённость, а правило. */
const SHARED_TYPES = new Set(['decision', 'design']);

/** Присутствие этих типов в источнике — признак узкого домена, а не общих практик. */
const NARROW_DOMAIN_TYPES = new Set(['requirement', 'task', 'map', 'verification', 'contract']);

/**
 * Статусы, за которыми записи нет: retired-запись не свидетельствует о том,
 * что источник — чужой рабочий проект, а свидетельствует об обратном — что
 * его почистили. Без этого фильтра почищенный источник получал бы то же
 * предупреждение, что и захламлённый, и чистить было бы незачем.
 */
const RETIRED_STATUSES = new Set(['dropped', 'superseded', 'rejected']);

export interface SharedRecord {
  id: string;
  type: string;
  title: string;
  status: string;
  tags: string[];
}

/**
 * Что из источника подключается по выбранным тегам: только `decision`/`design`,
 * только подтверждённое, только с пересечением тегов. Тегов не выбрано —
 * не «взять всё», а взять ничего: подключение выбором тегов, а не переносом
 * файла (docs/06-phases.md, фаза 13).
 */
export function sharedRecordsOf(records: readonly IndexRecord[], tags: readonly string[]): SharedRecord[] {
  if (tags.length === 0) return [];
  const wanted = new Set(tags);

  return records
    .filter((record) => SHARED_TYPES.has(record.type))
    .filter((record) => record.status === 'approved')
    .filter((record) => record.tags.some((tag) => wanted.has(tag)))
    .map(({ id, type, title, status, tags: recordTags }) => ({ id, type, title, status, tags: [...recordTags] }));
}

/**
 * Типы записей источника, по которым видно: это чужой рабочий проект, а не
 * источник практик. Не блокирует подключение — `decision`/`design` из него
 * всё равно отбираются, как из любого источника, — но делает несовпадение
 * заметным, а не тихо принятой связью.
 */
export function narrowDomainTypes(records: readonly IndexRecord[]): string[] {
  return [...new Set(
    records
      .filter((record) => !RETIRED_STATUSES.has(record.status))
      .map((record) => record.type)
      .filter((type) => NARROW_DOMAIN_TYPES.has(type))
  )].sort();
}

/**
 * Все теги, которыми размечены `decision`/`design` источника, — независимо
 * от того, что сейчас выбрано в `sources.shared`. Это и есть список для
 * галочек на экране «Практики»: показывает, чем вообще можно подключиться,
 * а не только то, что уже подключено (docs/11-shared-sources.md).
 */
export function availableTagsOf(records: readonly IndexRecord[]): string[] {
  return [...new Set(
    records
      .filter((record) => SHARED_TYPES.has(record.type))
      .filter((record) => record.status === 'approved')
      .flatMap((record) => record.tags)
  )].sort();
}
