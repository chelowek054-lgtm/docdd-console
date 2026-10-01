import type { MapChange } from './maps';

/**
 * История курса проекта (docs/07-maps.md, «Источник правды и история курса»).
 * Своего хранилища нет: время и автор правки курса уже лежат в записи карты —
 * в строке журнала, которой она получила `approved`. Чистые функции над
 * строками и разобранными блоками.
 */

export interface Approval {
  /** Дата строки журнала, а нет её — `updated` записи; пусто, если нет и того. */
  at: string;
  /** Роль оттуда же; `null` — не указана (честнее, чем придумать). */
  by: string | null;
}

/** `- 2026-10-01 · подтверждён · architect` — слово то же, что пишет `applyStatusChange` (`JOURNAL_ACTIONS`). */
const APPROVED_LINE = /^[-*]\s+(\d{4}-\d{2}-\d{2})\s+·\s+подтверждён(?:\s+·\s+(.+?))?\s*$/;

/** Последнее подтверждение карты: её могли вернуть в черновик и подтвердить снова. */
export function approvalOf(body: string, updated: string | undefined): Approval {
  let found: Approval | null = null;
  for (const line of body.split(/\r?\n/)) {
    const match = APPROVED_LINE.exec(line);
    if (match) found = { at: match[1] ?? '', by: match[2]?.trim() || null };
  }
  return found ?? { at: updated ?? '', by: null };
}

export interface CourseEntry {
  map: string;
  title: string;
  at: string;
  by: string | null;
  /** Новых возможностей. */
  added: number;
  /** Убрано возможностей. */
  removed: number;
  /** У скольких уже существовавших возможностей сменилось состояние реализации. */
  statusChanged: number;
  /** Связей добавлено и убрано. */
  relations: number;
  /** Изменён вектор проекта. */
  vision: boolean;
}

export interface CourseSource {
  id: string;
  title: string;
  approval: Approval;
  change: MapChange;
}

/**
 * Записи — по подтверждённой карте с функциональным блоком, от новых к
 * старым. Источники приходят в порядке подтверждения (как их складывает
 * `foldMaps`): так «новая» возможность отличается от уточнения прежней, а
 * смена состояния — от первого объявления.
 */
export function courseHistory(sources: readonly CourseSource[]): CourseEntry[] {
  const known = new Map<string, string | undefined>();
  const entries: CourseEntry[] = [];

  for (const source of sources) {
    const part = source.change.functional;
    if (!part) continue;

    let added = 0;
    let statusChanged = 0;
    for (const item of part.added?.capabilities ?? []) {
      if (!known.has(item.id)) added += 1;
      else if (known.get(item.id) !== item.status) statusChanged += 1;
      known.set(item.id, item.status);
    }
    const removedItems = part.removed?.capabilities ?? [];
    for (const item of removedItems) known.delete(item.id);

    const relations = (part.added?.relations?.length ?? 0) + (part.removed?.relations?.length ?? 0);
    const vision = !!part.added?.vision;
    if (added + removedItems.length + statusChanged + relations === 0 && !vision) continue;

    entries.push({
      map: source.id,
      title: source.title,
      at: source.approval.at,
      by: source.approval.by,
      added,
      removed: removedItems.length,
      statusChanged,
      relations,
      vision
    });
  }
  return entries.reverse();
}
