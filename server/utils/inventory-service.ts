import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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

/** Через столько посчитанных файлов проход сохраняется: прервали — уцелеет. */
const FLUSH_EVERY = 50;

interface FileNote {
  size: number;
  /** Время изменения: ориентир, по которому решают, надо ли перечитывать. */
  mtime: number;
  hash: string;
}

interface Inventory {
  version: 1;
  /** Кэш отпечатков: ускоряет проход и ни на что больше не влияет. */
  files: Record<string, FileNote>;
  /** Что описано и с каким отпечатком на момент подтверждения карты. */
  described: Record<string, string>;
}

function pathOf(root: string): string {
  return join(normalizeRoot(root), FILE);
}

function empty(): Inventory {
  return { version: 1, files: {}, described: {} };
}

export function readInventoryFile(root: string): Inventory {
  const path = pathOf(root);
  if (!existsSync(path)) return empty();

  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return empty();

    const raw = parsed as Partial<Inventory> & Record<string, unknown>;
    // Старый плоский вид (`путь: отпечаток`) читается как описанное: уже
    // записанное не должно пропасть от смены формата.
    if (!raw.version) {
      return { version: 1, files: {}, described: parsed as Record<string, string> };
    }

    return {
      version: 1,
      files: raw.files ?? {},
      described: raw.described ?? {}
    };
  } catch {
    // Испорченная опись — не беда: заход просто перечитает проект заново.
    return empty();
  }
}

function write(root: string, inventory: Inventory): void {
  const path = pathOf(root);
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
  } catch {
    // Не записалось — следующий заход перечитает. Терять тут нечего.
  }
}

/** Что было описано и с каким отпечатком на момент подтверждения карты. */
export function readDescribed(root: string): Record<string, string> {
  return readInventoryFile(root).described;
}

export function fingerprint(text: string): string {
  return createHash('sha1').update(text).digest('hex').slice(0, 16);
}

/**
 * Файлы кода с отпечатками. Содержимое читается только там, где разошёлся
 * ориентир — размер и время изменения; совпали оба, берётся прошлый отпечаток.
 *
 * Ориентир — не доказательство: его можно подделать, и при переносе проекта он
 * меняется сам. Решает всё равно отпечаток, просто считается он не всегда.
 */
export function marksOf(root: string): FileMark[] {
  const normalized = normalizeRoot(root);
  const workspace = readWorkspace(normalized);
  const inventory = readInventoryFile(normalized);

  const files: Record<string, FileNote> = {};
  const marks: FileMark[] = [];
  let counted = 0;

  for (const path of workspace.codeFiles) {
    const absolute = join(normalized, path);

    let size = -1;
    let mtime = -1;
    try {
      const info = statSync(absolute);
      size = info.size;
      mtime = Math.round(info.mtimeMs);
    } catch {
      // Файл исчез между обходом и описью: пусть считается изменившимся.
    }

    const known = inventory.files[path];
    if (known && known.size === size && known.mtime === mtime) {
      files[path] = known;
      marks.push({ path, hash: known.hash });
      continue;
    }

    let hash = '';
    try {
      hash = fingerprint(readFileSync(absolute, 'utf8'));
    } catch {
      // Нечитаемый файл описи не мешает: он просто без отпечатка.
    }

    files[path] = { size, mtime, hash };
    marks.push({ path, hash });
    counted += 1;

    // Сохраняем по ходу, а не в конце: прервали проход — уцелеет посчитанное.
    if (counted % FLUSH_EVERY === 0) {
      write(normalized, { version: 1, files: { ...inventory.files, ...files }, described: inventory.described });
    }
  }

  if (counted > 0) write(normalized, { version: 1, files, described: inventory.described });
  return marks;
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
  const marks = new Map(marksOf(normalized).map((mark) => [mark.path, mark.hash]));
  const inventory = readInventoryFile(normalized);

  let marked = 0;
  for (const path of describedBy(parseMapRecord(body).change)) {
    const hash = marks.get(path);
    // Отмечаем только файлы кода: свидетельство может указывать и на документ.
    if (hash === undefined) continue;
    inventory.described[path] = hash;
    marked += 1;
  }

  if (marked > 0) write(normalized, inventory);
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
  const inventory = readInventoryFile(normalized);
  const described: Record<string, string> = {};

  for (const record of index.records) {
    if (record.type !== 'map' || record.status !== 'approved') continue;
    for (const path of describedBy(parseMapRecord(readBody(record.path)).change)) {
      const hash = marks.get(path);
      if (hash !== undefined) described[path] = hash;
    }
  }

  write(normalized, { ...inventory, described });
  return Object.keys(described).length;
}
