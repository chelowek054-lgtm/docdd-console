import { readFileSync } from 'node:fs';

import { buildContextPack, type ContextNeeds, type ContextPack, type ContextSource } from '../lib/context-pack';
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
  task: { kinds: ['record', 'links', 'capability', 'vision', 'reference', 'glossary'], depth: 1, linkKinds: ['implements', 'depends_on', 'reuses', 'affects', 'refines'], budget: 40_000 },
  fix: { kinds: ['record', 'issues'], depth: 0, budget: 12_000 },
  inbox: { kinds: ['vision', 'reference', 'capability'], depth: 0, budget: 30_000 },
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
    sources: SOURCES
  });
}
