import { createHash } from 'node:crypto';

import type { WorkRecord } from './types';

/**
 * Версия записи для оптимистической блокировки (R-0018). Хэш содержания, а не
 * `updated`: дата хранится с точностью до дня, и две правки за день были бы
 * неотличимы. Считается из разобранной записи, поэтому клиент (через индекс) и
 * сервер (при записи) получают одно и то же значение.
 */
export function versionOf(record: Pick<WorkRecord, 'data' | 'body'>): string {
  return createHash('sha1').update(JSON.stringify([record.data, record.body])).digest('hex').slice(0, 12);
}

/** Версия не передана — проверки нет: старые клиенты и скрипты не ломаются. */
export function versionConflict(record: Pick<WorkRecord, 'data' | 'body'>, expected: unknown): boolean {
  return typeof expected === 'string' && expected !== '' && expected !== versionOf(record);
}
