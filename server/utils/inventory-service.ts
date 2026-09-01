import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { describedBy, inventoryState, type FileMark, type InventoryState } from '../lib/inventory';
import { parseMapRecord } from '../lib/maps';
import { normalizeRoot } from '../lib/paths';
import { readWorkspace } from '../lib/workspace';
import { loadIndex } from './index-service';

/**
 * Опись файлов проекта: отпечатки и память о том, что уже описано
 * (docs/07-maps.md, раздел «Опись файлов»).
 *
 * Память лежит в `.docdd` и потому расходная: удалили — следующий заход
 * перечитает всё заново. Потеряется экономия, не правда: правда живёт в
 * подтверждённых записях.
 */

const FILE = '.docdd/maps-index.json';

function pathOf(root: string): string {
  return join(normalizeRoot(root), FILE);
}

/** Что было описано и с каким отпечатком на момент подтверждения карты. */
export function readDescribed(root: string): Record<string, string> {
  const path = pathOf(root);
  if (!existsSync(path)) return {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    // Испорченная опись — не беда: заход просто перечитает проект заново.
    return {};
  }
}

function writeDescribed(root: string, described: Record<string, string>): void {
  const path = pathOf(root);
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(described, null, 2)}\n`, 'utf8');
  } catch {
    // Не записалось — следующий заход перечитает всё. Терять тут нечего.
  }
}

export function fingerprint(text: string): string {
  return createHash('sha1').update(text).digest('hex').slice(0, 16);
}

/** Файлы кода с отпечатками. Нечитаемый файл описи не мешает: он просто пуст. */
export function marksOf(root: string): FileMark[] {
  const normalized = normalizeRoot(root);
  const workspace = readWorkspace(normalized);

  return workspace.codeFiles.map((path) => {
    try {
      return { path, hash: fingerprint(readFileSync(join(normalized, path), 'utf8')) };
    } catch {
      return { path, hash: '' };
    }
  });
}

export function inventoryOf(root: string): InventoryState {
  const normalized = normalizeRoot(root);
  return inventoryState(marksOf(normalized), readDescribed(normalized));
}

/**
 * Отметить описанное. Зовётся в момент **подтверждения** карты, а не когда
 * пришёл ответ: неподтверждённый черновик не должен съедать файлы из очереди —
 * иначе отклонили черновик, а файлы считаются описанными.
 */
export function markDescribed(root: string, body: string): number {
  const normalized = normalizeRoot(root);
  const described = readDescribed(normalized);
  const marks = new Map(marksOf(normalized).map((mark) => [mark.path, mark.hash]));

  let marked = 0;
  for (const path of describedBy(parseMapRecord(body).change)) {
    const hash = marks.get(path);
    // Отмечаем только файлы кода: свидетельство может указывать и на документ.
    if (hash === undefined) continue;
    described[path] = hash;
    marked += 1;
  }

  if (marked > 0) writeDescribed(normalized, described);
  return marked;
}

/**
 * Пересобрать опись по всем подтверждённым картам. Нужна, когда память
 * потеряли: правда в записях, и её можно перечитать.
 */
export function rebuildDescribed(root: string, readBody: (path: string) => string): number {
  const normalized = normalizeRoot(root);
  const index = loadIndex(normalized);
  const marks = new Map(marksOf(normalized).map((mark) => [mark.path, mark.hash]));
  const described: Record<string, string> = {};

  for (const record of index.records) {
    if (record.type !== 'map' || record.status !== 'approved') continue;
    for (const path of describedBy(parseMapRecord(readBody(record.path)).change)) {
      const hash = marks.get(path);
      if (hash !== undefined) described[path] = hash;
    }
  }

  writeDescribed(normalized, described);
  return Object.keys(described).length;
}
