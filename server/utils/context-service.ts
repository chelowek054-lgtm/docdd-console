import { existsSync, readFileSync } from 'node:fs'; import { glossaryChunk, parseGlossary } from '../lib/glossary';

import { buildContextPack, makeChunk, renderContextPack, type ContextNeeds, type ContextPack, type ContextSource } from '../lib/context-pack';
import { parseRecord } from '../lib/parse';
import { normalizeRoot, resolveInside } from '../lib/paths';
import type { WorkRecord } from '../lib/types';
import { loadIndex } from './index-service';
import { buildProjectMap } from './map-service';
import { referenceIndexText } from './reference-service';

/**
 * Пакет контекста для проекта (docs/adr/0021-context-pack.md): читает записи
 * с диска и отдаёт их чистой функции. Список источников расширяется (`SOURCES`):
 * глоссарий подключается добавлением источника сюда, а не правкой сборщика.
 */
export const SOURCES: ContextSource[] = [];

/** Роли, которым нужен глоссарий (docs/prompts/roles): менеджеру и наблюдателю термины не нужны. */
const GLOSSARY_ROLES = new Set(['analyst', 'domain']);

/** Что нужно каждому виду запроса; чего нет в списке, в пакет не попадает. */
export const NEEDS: Record<string, ContextNeeds> = {
  ask: { kinds: ['record', 'links', 'capability', 'vision', 'glossary'], depth: 1, budget: 24_000 },
  task: { kinds: ['record', 'links', 'capability', 'vision', 'reference', 'glossary', 'codemap'], depth: 1, linkKinds: ['implements', 'depends_on', 'reuses', 'affects', 'refines'], budget: 40_000 },
  fix: { kinds: ['record', 'issues', 'vision'], depth: 0, budget: 12_000 },
  inbox: { kinds: ['vision', 'reference', 'capability', 'glossary'], depth: 0, budget: 30_000 },
  role: { kinds: ['record', 'links', 'capability', 'vision', 'reference', 'issues', 'glossary'], depth: 2, budget: 40_000 }
};

/** Записи проекта с телом: индекс тела не хранит, документ принадлежит человеку и читается из файла. */
export function workRecords(root: string): WorkRecord[] {
  const normalized = normalizeRoot(root);
  const found: WorkRecord[] = [];
  for (const item of loadIndex(normalized).records) {
    try {
      const parsed = parseRecord(readFileSync(resolveInside(normalized, item.path), 'utf8'), { path: item.path });
      if (parsed.ok) found.push(parsed.record);
    } catch {
      // Запись не читается — в пакете её нет; нарушение покажет индекс.
    }
  }
  return found;
}

/**
 * Нужды роли по её шаблону (docs/prompts/roles/*.md): общий вид `role` сужается
 * до объявленного в шаблоне; глубина и `issues` берутся оттуда же.
 */
export function roleNeeds(role: string): ContextNeeds {
  const base = NEEDS['role']!;
  const by: Record<string, ContextNeeds> = {
    manager: { ...base, kinds: ['record', 'links', 'capability', 'vision', 'issues'], depth: 2 },
    analyst: { ...base, kinds: ['record', 'links', 'capability', 'vision', 'glossary'], depth: 2 },
    domain: { ...base, kinds: ['record', 'links', 'vision', 'glossary'], depth: 1 },
    observer: { ...base, kinds: ['record', 'links', 'vision'], depth: 1 }
  };
  return by[role] ?? NEEDS['ask']!;
}

/** Возможности записи: сама возможность по id или те, что объявила карта, связанная с записью через `affects`. */
export function capabilityIdsOf(records: readonly WorkRecord[], centerId: string, capabilities: readonly { id: string; declaredBy?: string | undefined }[]): string[] {
  const found = new Set<string>();
  const known = new Set(capabilities.map((item) => item.id));
  if (known.has(centerId)) found.add(centerId);
  const center = records.find((record) => record.id === centerId);
  const maps = new Set<string>();
  for (const item of records) {
    if (item.type !== 'map') continue;
    if ((center?.links.affects ?? []).includes(item.id) || (item.links.affects ?? []).includes(centerId)) maps.add(item.id);
  }
  for (const item of capabilities) if (item.declaredBy && maps.has(item.declaredBy)) found.add(item.id);
  return [...found].sort();
}

/** Источник глоссария: в пакет идут только термины, упомянутые в тексте запроса (центр и вопрос). */
function glossarySource(root: string, requestText: string): ContextSource {
  return ({ centerId, records }) => {
    const path = resolveInside(normalizeRoot(root), 'docs/development/glossary.md');
    if (!existsSync(path)) return [];
    const center = records.find((record) => record.id === centerId);
    const chunk = glossaryChunk(parseGlossary(readFileSync(path, 'utf8')), [center?.title ?? '', center?.body ?? '', requestText].join(String.fromCharCode(10)));
    return chunk ? [makeChunk({ key: 'glossary', kind: 'glossary', source: chunk.source, why: chunk.why, title: 'Глоссарий', text: chunk.text, rank: 30 })] : [];
  };
}

export function packFor(root: string, centerId: string, need: string | ContextNeeds, options: { role?: string; requestText?: string } = {}): ContextPack {
  const needs = typeof need === 'string' ? (NEEDS[need] ?? NEEDS['ask']!) : need;
  const functional = buildProjectMap(root).functional;
  const records = workRecords(root);
  const withGlossary = !options.role || GLOSSARY_ROLES.has(options.role);
  const vision = functional.vision
    ? [functional.vision.problem, functional.vision.outcome ? `Успех: ${functional.vision.outcome}` : '', functional.vision.not ? `Не делает: ${functional.vision.not}` : ''].filter(Boolean).join('\n')
    : null;
  return buildContextPack({
    records,
    centerId,
    needs,
    capabilities: functional.capabilities,
    capabilityIds: capabilityIdsOf(records, centerId, functional.capabilities),
    issues: loadIndex(root).issues.map((issue) => ({ code: issue.code, message: issue.message, recordId: issue.recordId ?? undefined })),
    vision,
    referenceIndex: referenceIndexText(root),
    sources: [...SOURCES, ...(withGlossary ? [glossarySource(root, options.requestText ?? '')] : []), codemapSource(root)]
  });
}

/**
 * Карта кода «Где что лежит» отдельным видом куска (T-0031): запрос на задачу
 * не беднеет от перехода на пакет, а человек может исключить карту в предпросмотре.
 */
export function codemapSource(root: string): ContextSource {
  return () => {
    const modules = buildProjectMap(root).codemap.modules;
    if (modules.length === 0) return [];
    const text = ['Подтверждённая карта проекта — по ней видно устройство, читать все файлы не нужно:', '',
      ...modules.map((module) => `- \`${module.id}\`${module.title ? ` — ${module.title}` : ''}${module.layer ? ` [${module.layer}]` : ''}`)].join(String.fromCharCode(10));
    return [makeChunk({ key: 'codemap', kind: 'codemap', source: 'карта кода', why: 'устройство проекта', title: 'Где что лежит', text, rank: 20 })];
  };
}

/**
 * Дополнение запроса из пакета: то, чего в самом запросе ещё нет. Записи,
 * связи и справочник сборщики кладут сами, поэтому здесь они отсекаются, иначе
 * запрос вырос бы вдвое вместо того, чтобы уменьшиться.
 */
export function packExtra(root: string, centerId: string, need: string, requestText = ''): string {
  const pack = packFor(root, centerId, need, { requestText });
  const own = new Set(['record', 'links', 'reference']);
  return renderContextPack({ ...pack, chunks: pack.chunks.filter((chunk) => !own.has(chunk.kind)), cut: [] }, { allowConfidential: false }).trim();
}
