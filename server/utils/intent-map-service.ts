import { applyFieldPatch } from '../lib/actions';
import type { LinkKind } from '../lib/types';
import { intentMapBody, intentMapTitle } from '../lib/intent-map';
import { createRecords } from './inbox-service';
import { loadIndex } from './index-service';
import { openRecord, today, writeRecord } from './record-write';

/**
 * Карта-намерение на пачку уже заведённых задач (docs/03-server-api.md,
 * `records/bulk/link-map`). Берутся только `feature`-задачи без единой
 * `affects`; карта — черновик, ничего не подтверждается.
 */

export interface LinkSkipped {
  id: string;
  message: string;
}

export type LinkOutcome =
  | { ok: true; map: { id: string; title: string; path: string }; linked: string[]; skipped: LinkSkipped[] }
  | { ok: false; code: string; message: string; skipped: LinkSkipped[] };

export function linkIntentMap(root: string, ids: readonly string[]): LinkOutcome {
  const records = loadIndex(root, true).records;
  const eligible: { id: string; title: string }[] = [];
  const skipped: LinkSkipped[] = [];

  for (const id of new Set(ids)) {
    const record = records.find((item) => item.id === id);
    if (!record) {
      skipped.push({ id, message: `Записи \`${id}\` в проекте нет` });
    } else if (record.type !== 'task') {
      skipped.push({ id, message: `${id} — не задача: карта привязывается к задачам` });
    } else if (record.extra['change'] !== 'feature') {
      skipped.push({ id, message: `У ${id} изменение не \`feature\`: карта ей не требуется` });
    } else if ((record.links.affects ?? []).length > 0) {
      skipped.push({ id, message: `${id} уже связана с картой — связь не трогается` });
    } else {
      eligible.push({ id, title: record.title });
    }
  }

  if (eligible.length === 0) {
    return { ok: false, code: 'nothing_to_link', message: 'Привязывать нечего: ни одна задача не подошла', skipped };
  }

  const stamp = today();
  const made = createRecords(root, [{
    key: 'intent-map',
    type: 'map',
    title: intentMapTitle(stamp),
    body: intentMapBody(eligible.map((task) => `${task.id} — ${task.title}`)),
    intent: true
  }], []);
  const map = made.ok ? made.created[0] : undefined;
  if (!made.ok || !map) {
    return { ok: false, code: made.ok ? 'map_not_created' : made.code, message: made.ok ? 'Карту завести не удалось' : made.message, skipped };
  }

  const linked: string[] = [];
  for (const task of eligible) {
    const context = openRecord(root, task.id);
    if (!context) {
      skipped.push({ id: task.id, message: `Записи \`${task.id}\` в проекте нет` });
      continue;
    }
    // Остальные связи задачи остаются как были: к ним добавляется одна `affects`.
    const links = Object.fromEntries(
      Object.entries(context.record.links).map(([kind, ids]) => [kind, [...(ids ?? [])]])
    ) as Partial<Record<LinkKind, string[]>>;
    const outcome = applyFieldPatch(context.original, { links: { ...links, affects: [map.id] } }, stamp);
    const written = writeRecord(context, outcome, root);
    if (written.ok) linked.push(task.id);
    else skipped.push({ id: task.id, message: `Запись отменена: ${written.problems.join(' ')}` });
  }

  loadIndex(root, true);
  return { ok: true, map: { id: map.id, title: map.title, path: map.path }, linked, skipped };
}
