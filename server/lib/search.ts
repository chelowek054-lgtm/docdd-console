/**
 * Полнотекстовый поиск по записям и знаниям (T-0040). Обратный индекс
 * «слово → документы» строится из текстов в памяти и пересобирается при смене
 * отпечатка файлов: своей базы нет, всё производное (ADR-0001).
 */
export interface SearchDoc { id: string; title: string; path: string; type: string; text: string }
export interface SearchHit { id: string; title: string; path: string; type: string; score: number; snippet: string }

export interface SearchIndex {
  docs: SearchDoc[];
  /** Слово → номера документов с числом вхождений. */
  postings: Map<string, Map<number, number>>;
  titleWords: Map<string, Set<number>>;
}

export function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^\p{L}\p{N}_-]+/u).filter((word) => word.length > 1);
}

export function buildSearchIndex(docs: readonly SearchDoc[]): SearchIndex {
  const postings = new Map<string, Map<number, number>>();
  const titleWords = new Map<string, Set<number>>();
  docs.forEach((doc, number) => {
    for (const word of tokenize(doc.text)) {
      let row = postings.get(word);
      if (!row) postings.set(word, (row = new Map()));
      row.set(number, (row.get(number) ?? 0) + 1);
    }
    for (const word of tokenize(`${doc.id} ${doc.title}`)) {
      let set = titleWords.get(word);
      if (!set) titleWords.set(word, (set = new Set()));
      set.add(number);
    }
  });
  return { docs: [...docs], postings, titleWords };
}

/** Все слова запроса должны найтись (приставка слова допустима); заголовок весит больше тела. */
export function searchIndex(index: SearchIndex, query: string, limit = 50): SearchHit[] {
  const words = tokenize(query);
  if (words.length === 0) return [];
  let scores = null as Map<number, number> | null;
  for (const word of words) {
    const next = new Map<number, number>();
    for (const [key, row] of index.postings) {
      if (!key.startsWith(word)) continue;
      for (const [doc, count] of row) next.set(doc, (next.get(doc) ?? 0) + Math.min(count, 5));
    }
    for (const [key, set] of index.titleWords) {
      if (!key.startsWith(word)) continue;
      for (const doc of set) next.set(doc, (next.get(doc) ?? 0) + 20);
    }
    scores = scores ? new Map<number, number>([...scores].filter(([doc]) => next.has(doc)).map(([doc, score]): [number, number] => [doc, score + (next.get(doc) ?? 0)])) : next;
  }
  return [...(scores ?? [])]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, limit)
    .map(([number, score]) => {
      const doc = index.docs[number] as SearchDoc;
      return { id: doc.id, title: doc.title, path: doc.path, type: doc.type, score, snippet: snippetOf(doc.text, words[0] ?? '') };
    });
}

function snippetOf(text: string, word: string): string {
  const at = text.toLowerCase().indexOf(word);
  const from = Math.max(0, at - 40);
  return text.slice(from, from + 140).replace(/\s+/g, ' ').trim();
}
