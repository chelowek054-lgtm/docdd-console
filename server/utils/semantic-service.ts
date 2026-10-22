import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';

import { onCacheDropped } from '../lib/cache';
import { normalizeRoot, resolveInside } from '../lib/paths';
import { hashEmbed, LOCAL_MODEL, normalize, recordBlocks, snippetOf, TopHits, type Block, type Entry, type Hit } from '../lib/semantic';
import { readWorkspace } from '../lib/workspace';
import { inboxNotes } from './inbox-service';
import { loadIndex } from './index-service';

/**
 * Индекс смыслового поиска (docs/adr/0031-semantic-search.md). Файл —
 * `.docdd/embeddings.jsonl`, производный кэш. Актуальность держится сама:
 * отпечаток файлов проекта → новые блоки → встраиваются только блоки с другим
 * хешом текста; после записи консолью индекс досчитывается в фоне.
 */

const BATCH = 500;
const EMBED_BATCH = 64;
const WARM_DELAY_MS = 2000;

const fileOf = (root: string) => join(normalizeRoot(root), '.docdd', 'embeddings.jsonl');

interface Embedder {
  model: string;
  /** Блоки с тегом confidential внешнему провайдеру не уходят, если он не допущен к закрытым данным. */
  allowsClosed: boolean;
  embed(texts: string[]): Promise<number[][]>;
}

const localEmbedder: Embedder = { model: LOCAL_MODEL, allowsClosed: true, embed: async (texts) => texts.map((text) => hashEmbed(text)) };

/** Провайдер эмбеддингов из настроек моделей: `embeddings.provider` → OpenAI-совместимый с `embeddingModel`. */
async function embedder(): Promise<Embedder> {
  try {
    const { loadLlmSettings, resolveKey } = await import('./llm-settings');
    const settings = await loadLlmSettings();
    const chosen = (settings['embeddings'] as { provider?: string } | undefined)?.provider;
    const provider = settings.providers.find((item) => item.id === chosen && item.enabled !== false);
    const model = (provider as { embeddingModel?: string } | undefined)?.embeddingModel;
    if (!provider || provider.type !== 'openai' || !provider.baseUrl || !model) return localEmbedder;
    const key = resolveKey(provider);
    return {
      model: `${provider.id}:${model}`,
      allowsClosed: provider.closedData === true,
      async embed(texts) {
        const response = await fetch(`${provider.baseUrl!.replace(/\/+$/, '')}/embeddings`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
          body: JSON.stringify({ model, input: texts })
        });
        if (!response.ok) throw new Error(`эмбеддинги: HTTP ${response.status}`);
        const body = await response.json() as { data?: { embedding: number[]; index?: number }[] };
        const data = [...(body.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
        if (data.length !== texts.length) throw new Error('эмбеддинги: ответ не по числу входов');
        return data.map((item) => normalize(item.embedding));
      }
    };
  } catch {
    return localEmbedder;
  }
}

/** Блоки проекта: записи по разделам и входящие заметки. */
function projectBlocks(root: string, allowsClosed: boolean): Block[] {
  const blocks: Block[] = [];
  for (const record of loadIndex(root).records) {
    if (!allowsClosed && record.tags.includes('confidential')) continue;
    let source = '';
    try { source = readFileSync(resolveInside(root, record.path), 'utf8'); } catch { continue; }
    blocks.push(...recordBlocks(record, source));
  }
  for (const note of inboxNotes(root)) blocks.push(...recordBlocks({ id: note.path, type: 'note', title: note.title }, note.text));
  return blocks;
}

async function* readEntries(file: string): AsyncGenerator<Entry[]> {
  if (!existsSync(file)) return;
  const lines = createInterface({ input: createReadStream(file, 'utf8'), crlfDelay: Infinity });
  let batch: Entry[] = [];
  for await (const line of lines) {
    if (!line.trim()) continue;
    try { batch.push(JSON.parse(line) as Entry); } catch { /* битая строка — пересчитается при следующей сборке */ }
    if (batch.length >= BATCH) { yield batch; batch = []; }
  }
  if (batch.length) yield batch;
}

const fresh = new Map<string, { fingerprint: string; model: string; blocks: number }>();
const building = new Map<string, Promise<{ model: string; blocks: number }>>();

/** Досчитать индекс: только изменившиеся блоки; удалённые выпадают; новая модель — пересборка. */
export async function ensureIndex(root: string): Promise<{ model: string; blocks: number }> {
  const normalized = normalizeRoot(root);
  const running = building.get(normalized);
  if (running) return running;
  const job = (async () => {
    const fingerprint = readWorkspace(normalized).fingerprint;
    const embed = await embedder();
    const known = fresh.get(normalized);
    const file = fileOf(normalized);
    if (known && known.fingerprint === fingerprint && known.model === embed.model && existsSync(file)) return known;

    const old = new Map<string, Entry>();
    for await (const batch of readEntries(file)) {
      for (const entry of batch) if (entry.model === embed.model) old.set(entry.key, entry);
    }
    const blocks = projectBlocks(normalized, embed.allowsClosed);
    const entries: Entry[] = [];
    const missing: Block[] = [];
    for (const block of blocks) {
      const prior = old.get(block.key);
      if (prior && prior.hash === block.hash) entries.push(prior);
      else missing.push(block);
    }
    for (let i = 0; i < missing.length; i += EMBED_BATCH) {
      const part = missing.slice(i, i + EMBED_BATCH);
      const vectors = await embed.embed(part.map((block) => block.text));
      part.forEach((block, n) => {
        const { text, ...rest } = block;
        entries.push({ ...rest, model: embed.model, snippet: snippetOf(text), vector: vectors[n]!.map((value) => Math.round(value * 1e5) / 1e5) });
      });
    }
    // Запись атомарно: поиск, читающий файл в этот момент, видит старую или новую версию целиком.
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(`${file}.tmp`, entries.map((entry) => JSON.stringify(entry)).join('\n') + (entries.length ? '\n' : ''), 'utf8');
    renameSync(`${file}.tmp`, file);
    const state = { fingerprint, model: embed.model, blocks: entries.length };
    fresh.set(normalized, state);
    return state;
  })();
  building.set(normalized, job);
  try {
    return await job;
  } finally {
    building.delete(normalized);
  }
}

export async function semanticSearch(root: string, query: string, limit: number): Promise<{ hits: Hit[]; model: string; blocks: number }> {
  const state = await ensureIndex(root);
  const embed = await embedder();
  const [vector] = await embed.embed([query]);
  const top = new TopHits(limit);
  for await (const batch of readEntries(fileOf(root))) top.addBatch(vector!, batch.filter((entry) => entry.model === embed.model));
  return { hits: top.result(), model: state.model, blocks: state.blocks };
}

// Прогрев после записи консолью: только у проектов, где индекс уже есть, — не строим его тем, кто не ищет.
const timers = new Map<string, ReturnType<typeof setTimeout>>();
onCacheDropped((root) => {
  if (!existsSync(fileOf(root))) return;
  clearTimeout(timers.get(root));
  timers.set(root, setTimeout(() => {
    timers.delete(root);
    ensureIndex(root).catch(() => { /* прогрев — оптимизация: ошибка проявится при поиске */ });
  }, WARM_DELAY_MS));
});
