/**
 * Смысловой поиск (docs/adr/0031-semantic-search.md): блоки записей, локальный
 * хеш-эмбеддинг и отбор лучших по скалярному произведению нормализованных
 * векторов. Чистые функции — без файлов и сети.
 */

export const LOCAL_MODEL = 'local-hash-v1';
export const LOCAL_DIM = 512;

export interface Block {
  /** `R-0001#kriterii` — запись и раздел; уникален в проекте. */
  key: string;
  recordId: string;
  type: string;
  title: string;
  heading: string;
  anchor: string;
  text: string;
  hash: string;
}

export interface Entry extends Omit<Block, 'text'> {
  model: string;
  snippet: string;
  vector: number[];
}

export interface Hit {
  key: string;
  recordId: string;
  type: string;
  title: string;
  heading: string;
  anchor: string;
  snippet: string;
  score: number;
}

/** FNV-1a: быстрый и стабильный хеш строки — для индексов измерений и отпечатка текста. */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function textHash(text: string): string {
  return fnv1a(text).toString(16).padStart(8, '0') + text.length.toString(16);
}

export function normalize(vector: readonly number[]): number[] {
  let sum = 0;
  for (const value of vector) sum += value * value;
  const norm = Math.sqrt(sum);
  return norm ? vector.map((value) => value / norm) : vector.map(() => 0);
}

export function dot(a: readonly number[], b: readonly number[]): number {
  const length = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < length; i += 1) sum += a[i]! * b[i]!;
  return sum;
}

function words(text: string): string[] {
  return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 1);
}

/**
 * Локальный эмбеддинг без сети: слова и триграммы символов (с границами слова)
 * хешируются в `dim` измерений со знаком, вес — логарифм частоты. Триграммы
 * сближают словоформы («проверка», «проверки», «проверок»), знак гасит случайные
 * столкновения хешей. Результат нормализован.
 */
export function hashEmbed(text: string, dim = LOCAL_DIM): number[] {
  const counts = new Map<number, number>();
  const add = (feature: string, weight: number) => {
    const hash = fnv1a(feature);
    const index = hash % dim;
    const sign = (hash >>> 31) & 1 ? -1 : 1;
    counts.set(index, (counts.get(index) ?? 0) + sign * weight);
  };
  for (const word of words(text)) {
    add(`w:${word}`, 1);
    const padded = `^${word}$`;
    for (let i = 0; i + 3 <= padded.length; i += 1) add(`t:${padded.slice(i, i + 3)}`, 0.5);
  }
  const vector = new Array<number>(dim).fill(0);
  for (const [index, value] of counts) vector[index] = Math.sign(value) * Math.log1p(Math.abs(value));
  return normalize(vector);
}

function slug(heading: string): string {
  return heading.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

/**
 * Запись → блоки по заголовкам `##`/`###`. Front matter и журнал (раздел «Журнал»)
 * в поиск не идут: это служебное, а не содержание. Заголовок записи — в каждый
 * блок: без него раздел «Решение» одного ADR неотличим от другого.
 */
export function recordBlocks(record: { id: string; type: string; title: string }, source: string): Block[] {
  const body = source.replace(/^---[\s\S]*?\n---[ \t]*\r?\n/, '');
  const sections: { heading: string; lines: string[] }[] = [{ heading: '', lines: [] }];
  for (const line of body.split(/\r?\n/)) {
    const match = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (match) sections.push({ heading: match[2]!, lines: [] });
    else if (!/^#\s/.test(line)) sections.at(-1)!.lines.push(line);
  }
  const blocks: Block[] = [];
  for (const section of sections) {
    if (/^журнал$/i.test(section.heading.trim())) continue;
    const content = section.lines.join('\n').trim();
    if (!content && section.heading) continue;
    const anchor = section.heading ? slug(section.heading) : '';
    const text = [record.title, section.heading, content].filter(Boolean).join('\n');
    if (!text.trim()) continue;
    blocks.push({
      key: anchor ? `${record.id}#${anchor}` : record.id,
      recordId: record.id,
      type: record.type,
      title: record.title,
      heading: section.heading,
      anchor,
      text,
      hash: textHash(text)
    });
  }
  // Ключи уникальны: одинаковые заголовки в одной записи получают номер.
  const seen = new Map<string, number>();
  for (const block of blocks) {
    const count = seen.get(block.key) ?? 0;
    seen.set(block.key, count + 1);
    if (count) block.key = `${block.key}-${count + 1}`;
  }
  return blocks;
}

export function snippetOf(text: string, length = 220): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > length ? `${flat.slice(0, length - 1)}…` : flat;
}

/**
 * Лучшие `limit` из потока записей: держим отсортированный хвост, а не весь
 * поток — память не растёт с размером индекса. Пачка — массив, чтобы цикл
 * скалярных произведений шёл подряд по памяти.
 */
export class TopHits {
  private hits: Hit[] = [];
  constructor(private readonly limit: number) {}

  addBatch(query: readonly number[], batch: readonly Entry[]): void {
    for (const entry of batch) {
      const score = dot(query, entry.vector);
      if (this.hits.length >= this.limit && score <= this.hits.at(-1)!.score) continue;
      const hit: Hit = { key: entry.key, recordId: entry.recordId, type: entry.type, title: entry.title, heading: entry.heading, anchor: entry.anchor, snippet: entry.snippet, score };
      let at = this.hits.findIndex((item) => item.score < score);
      if (at === -1) at = this.hits.length;
      this.hits.splice(at, 0, hit);
      if (this.hits.length > this.limit) this.hits.pop();
    }
  }

  result(): Hit[] {
    return [...this.hits];
  }
}
