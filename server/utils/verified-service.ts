import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { applyJournalNote } from '../lib/actions';
import { dropCache } from '../lib/cache';
import {
  isManualKind,
  manualReportName,
  manualReportText,
  verifiedJournalAction,
  type ManualState
} from '../lib/manual-report';
import { resolveInside } from '../lib/paths';
import { DEVELOPMENT_DIR, type VerificationOutcome } from '../lib/types';
import { loadIndex } from './index-service';
import { openRecord, today, writeRecord } from './record-write';

/**
 * Отметка «Проверено» на ручной проверке (docs/03-server-api.md,
 * `records/:recordId/verified`). Факт — отчёт в `tests/reports`, след — строка
 * в журнале записи. Отчёт первичен: не пропустил сторож журнал — отметка всё
 * равно стоит, а причина уходит в ответ.
 */

export type VerifiedOutcome =
  | { ok: true; result: VerificationOutcome | null; journal: string | null; warning?: string }
  | { ok: false; status: number; code: string; message: string };

export function markVerified(root: string, recordId: string, verified: boolean, actor: string): VerifiedOutcome {
  const context = openRecord(root, recordId);
  if (!context) {
    return { ok: false, status: 404, code: 'record_not_found', message: `Записи \`${recordId}\` в проекте нет` };
  }
  if (context.record.type !== 'verification') {
    return { ok: false, status: 409, code: 'not_a_verification', message: `${recordId} — не проверка: отметка «Проверено» ставится на проверках` };
  }
  if (!isManualKind(context.record.data['kind'])) {
    return {
      ok: false,
      status: 409,
      code: 'not_manual',
      message: `У проверки ${recordId} вид не \`manual\` и не \`review\`: факт приходит от сборки — положите отчёт в tests/reports`
    };
  }

  const testsFolder = context.workspace.manifest.paths?.tests;
  if (!testsFolder) {
    return { ok: false, status: 409, code: 'tests_not_configured', message: 'В манифесте не назван раздел `paths.tests`: отчёту некуда лечь' };
  }

  const now = new Date();
  const state: ManualState = verified ? 'passed' : 'skipped';
  const dir = resolveInside(root, join(DEVELOPMENT_DIR, testsFolder, 'reports'));
  mkdirSync(dir, { recursive: true });

  // Имя занято (две отметки в одну миллисекунду) — не затираем, а берём следующее.
  const base = manualReportName(recordId, now);
  let name = base;
  for (let n = 2; existsSync(join(dir, name)); n += 1) name = base.replace(/\.json$/, `-${n}.json`);
  writeFileSync(join(dir, name), manualReportText(recordId, state, actor, now), 'utf8');
  dropCache(root);

  // Журнал — след для человека. Сторож отказал — отметка всё равно поставлена.
  const outcome = applyJournalNote(context.original, {
    action: verifiedJournalAction(verified),
    actor,
    today: today(now)
  });
  const written = writeRecord(context, outcome, root);

  const result = loadIndex(root, true).verificationResults[recordId] ?? null;
  return {
    ok: true,
    result,
    journal: written.ok ? (outcome.journal ?? null) : null,
    ...(written.ok ? {} : { warning: `Отчёт записан, а строка в журнале — нет: ${written.problems.join(' ')}` })
  };
}
