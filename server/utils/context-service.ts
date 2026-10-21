import { readFileSync } from 'node:fs';

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

export function packFor(root: string, centerId: string, need: string | ContextNeeds): ContextPack {
  const needs = typeof need === 'string' ? (NEEDS[need] ?? NEEDS['ask']!) : need;
  const functional = buildProjectMap(root).functional;
  const vision = functional.vision
    ? [functional.vision.problem, functional.vision.outcome ? `Успех: ${functional.vision.outcome}` : '', functional.vision.not ? `Не делает: ${functional.vision.not}` : ''].filter(Boolean).join('\n')
    : null;
  return buildContextPack({
    records: workRecords(root),
    centerId,
    needs,
    capabilities: functional.capabilities,
    capabilityIds: [],
    vision,
    referenceIndex: referenceIndexText(root),
    sources: [...SOURCES, codemapSource(root)]
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
export function packExtra(root: string, centerId: string, need: string): string {
  const pack = packFor(root, centerId, need);
  const own = new Set(['record', 'links', 'reference']);
  return renderContextPack({ ...pack, chunks: pack.chunks.filter((chunk) => !own.has(chunk.kind)), cut: [] }, { allowConfidential: false }).trim();
}
