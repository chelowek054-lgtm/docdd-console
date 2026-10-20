import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { parseLines, toLine, type UsageRecord } from '../lib/llm-usage';

/** Рядом с аудитом: данные приложения лежат в `.data` (server/middleware/audit.ts). */
export const USAGE_FILE = resolve(process.cwd(), '.data', 'llm-usage.jsonl');

/** Дописывание, а не перезапись: параллельные запросы не затирают друг друга. */
export function recordUsage(record: UsageRecord, file: string = USAGE_FILE): void {
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, toLine(record) + '\n', 'utf8');
}

export function readUsage(file: string = USAGE_FILE): UsageRecord[] {
  return existsSync(file) ? parseLines(readFileSync(file, 'utf8')) : [];
}
