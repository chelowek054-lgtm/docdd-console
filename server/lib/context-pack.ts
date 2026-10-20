import { buildGraph } from './graph';
import { withoutJournal } from './write';
import type { LinkKind, WorkRecord } from './types';

/**
 * Пакет контекста запроса (docs/adr/0021-context-pack.md): чистая функция над
 * графом записей. Одинаковый вход даёт одинаковый пакет — иначе спор о том,
 * что модель «не знала», не решить чтением.
 */

export type ChunkKind = 'record' | 'links' | 'capability' | 'vision' | 'reference' | 'glossary' | 'issues' | 'reports' | (string & {});

export interface ContextChunk {
  /** Устойчивый ключ: по нему человек исключает кусок в предпросмотре. */
  key: string;
  kind: ChunkKind;
  /** Откуда взят: путь или идентификатор записи. */
  source: string;
  /** Почему включён: видно человеку и тому, кто разбирает спор. */
  why: string;
  title: string;
  text: string;
  /** Знаков в тексте. */
  size: number;
  /** Чем меньше, тем ближе к центру; нужен для отсечения по бюджету. */
  rank: number;
  /** Пометка `confidential` в теге: уходит только допущенному провайдеру. */
  confidential: boolean;
}

/** Что шаблон просит у пакета (ADR-0021, п. 2). */
export interface ContextNeeds {
  kinds: readonly ChunkKind[];
  /** Глубина обхода связей от центра; 0 — только сам центр. */
  depth?: number;
  /** Какие связи обходить; пусто — любые. */
  linkKinds?: readonly LinkKind[];
  /** Предел размера в знаках по всем кускам. */
  budget: number;
}

export interface CapabilityNode { id: string; title?: string | undefined; parent?: string | undefined; summary?: string | undefined }

/**
 * Дополнительный источник кусков (глоссарий, отчёты…). Список расширяется
 * без правки этой функции: источник сам решает, что отдать для центра.
 */
export type ContextSource = (input: { centerId: string; records: readonly WorkRecord[] }) => ContextChunk[];

export interface ContextInput {
  records: readonly WorkRecord[];
  centerId: string;
  needs: ContextNeeds;
  capabilities?: readonly CapabilityNode[];
  /** Возможности, которым запись принадлежит: по ним берётся цепочка родителей. */
  capabilityIds?: readonly string[];
  vision?: string | null;
  referenceIndex?: string | null;
  issues?: readonly { code: string; message: string; recordId?: string | undefined }[];
  sources?: readonly ContextSource[];
}

export interface ContextPack {
  centerId: string;
  chunks: ContextChunk[];
  /** Отрезанное по бюджету: модель должна знать, чего не видела. */
  cut: { key: string; title: string; size: number }[];
  size: number;
  budget: number;
}

export function makeChunk(part: Omit<ContextChunk, 'size' | 'confidential'> & { confidential?: boolean }): ContextChunk {
  return { ...part, confidential: part.confidential ?? false, size: part.text.length };
}

const isConfidential = (record: WorkRecord): boolean => {
  const tags = record.data['tags'];
  return Array.isArray(tags) && tags.includes('confidential');
};

function recordChunk(record: WorkRecord, why: string, rank: number): ContextChunk {
  return makeChunk({
    key: `record:${record.id}`,
    kind: 'record',
    source: record.id,
    why,
    title: `${record.id}: ${record.title}`,
    text: withoutJournal(record.body).trim(),
    rank,
    confidential: isConfidential(record)
  });
}

/** Обход связей в обе стороны по ширине; порядок стабилен: по расстоянию, затем по id. */
function neighbours(input: ContextInput): { record: WorkRecord; distance: number; via: string }[] {
  const graph = buildGraph(input.records);
  const depth = input.needs.depth ?? 1;
  const allowed = input.needs.linkKinds?.length ? new Set<string>(input.needs.linkKinds) : null;
  const seen = new Set<string>([input.centerId]);
  const found: { record: WorkRecord; distance: number; via: string }[] = [];
  let frontier = [input.centerId];

  for (let distance = 1; distance <= depth; distance += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      const edges = [...(graph.out.get(id) ?? []), ...(graph.in.get(id) ?? [])]
        .filter((edge) => !allowed || allowed.has(edge.kind));
      for (const edge of edges) {
        const other = edge.from === id ? edge.to : edge.from;
        const record = graph.byId.get(other);
        if (!record || seen.has(other)) continue;
        seen.add(other);
        next.push(other);
        found.push({ record, distance, via: `${edge.kind}: ${edge.from} → ${edge.to}` });
      }
    }
    frontier = next.sort();
  }
  return found.sort((a, b) => a.distance - b.distance || a.record.id.localeCompare(b.record.id));
}

export function buildContextPack(input: ContextInput): ContextPack {
  const wants = new Set<string>(input.needs.kinds);
  const center = input.records.find((record) => record.id === input.centerId);
  const all: ContextChunk[] = [];

  if (center && wants.has('record')) all.push(recordChunk(center, 'центр запроса', 0));

  if (wants.has('links') && center) {
    for (const { record, distance, via } of neighbours(input)) {
      all.push(recordChunk(record, `связь (${via})`, distance * 10));
    }
  }

  if (wants.has('capability') && input.capabilities?.length) {
    const byId = new Map(input.capabilities.map((item) => [item.id, item]));
    const done = new Set<string>();
    (input.capabilityIds ?? []).forEach((start, at) => {
      let step = 0;
      for (let item = byId.get(start); item && !done.has(item.id) && step < 20; item = item.parent ? byId.get(item.parent) : undefined, step += 1) {
        done.add(item.id);
        all.push(makeChunk({
          key: `capability:${item.id}`, kind: 'capability', source: item.id,
          why: step === 0 ? 'возможность записи' : 'родитель возможности',
          title: `${item.id}${item.title ? ` — ${item.title}` : ''}`,
          text: item.summary ?? item.title ?? item.id, rank: 5 + at + step
        }));
      }
    });
  }

  if (wants.has('vision') && input.vision?.trim()) {
    all.push(makeChunk({ key: 'vision', kind: 'vision', source: 'функциональная карта', why: 'вектор проекта', title: 'Вектор проекта', text: input.vision.trim(), rank: 3 }));
  }
  if (wants.has('reference') && input.referenceIndex?.trim()) {
    all.push(makeChunk({ key: 'reference', kind: 'reference', source: 'reference/INDEX.md', why: 'что уже есть (DRY)', title: 'Справочник', text: input.referenceIndex.trim(), rank: 40 }));
  }
  if (wants.has('issues') && input.issues?.length) {
    const rows = input.issues.filter((issue) => !issue.recordId || issue.recordId === input.centerId);
    if (rows.length) {
      all.push(makeChunk({ key: 'issues', kind: 'issues', source: input.centerId, why: 'нарушения записи', title: 'Нарушения', text: rows.map((row) => `- ${row.code}: ${row.message}`).join('\n'), rank: 2 }));
    }
  }
  for (const source of input.sources ?? []) {
    for (const chunk of source({ centerId: input.centerId, records: input.records })) {
      if (wants.has(chunk.kind)) all.push(chunk);
    }
  }

  // Сортировка не зависит от порядка источников: ключ — второй признак.
  all.sort((a, b) => a.rank - b.rank || a.key.localeCompare(b.key));

  const chunks: ContextChunk[] = [];
  const cut: ContextPack['cut'] = [];
  let size = 0;
  for (const chunk of all) {
    // Режем куском целиком, а не посередине; первый кусок берём всегда, иначе пакет пуст.
    if (size + chunk.size > input.needs.budget && chunks.length > 0) {
      cut.push({ key: chunk.key, title: chunk.title, size: chunk.size });
      continue;
    }
    chunks.push(chunk);
    size += chunk.size;
  }
  return { centerId: input.centerId, chunks, cut, size, budget: input.needs.budget };
}

/** Текст пакета для запроса; исключённые человеком куски и закрытые для провайдера не попадают. */
export function renderContextPack(pack: ContextPack, options: { exclude?: ReadonlySet<string>; allowConfidential?: boolean } = {}): string {
  const lines: string[] = [];
  for (const chunk of pack.chunks) {
    if (options.exclude?.has(chunk.key)) continue;
    if (chunk.confidential && !options.allowConfidential) continue;
    lines.push(`## ${chunk.title}`, '', `_${chunk.why}_`, '', chunk.text, '');
  }
  if (pack.cut.length) {
    lines.push('## Не вошло в контекст', '', ...pack.cut.map((item) => `- ${item.title} (${item.size} зн.)`), '');
  }
  return lines.join('\n');
}
