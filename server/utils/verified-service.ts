import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { applyJournalNote } from '../lib/actions';
import { dropCache } from '../lib/cache';
import {
  isManualKind,
  type ManualExtra,
  manualReportName,
  manualReportText,
  parseCheckSteps,
  runReportName,
  runReportText,
  type ReportStep,
  verifiedJournalAction,
  type ManualState
} from '../lib/manual-report';
import { resolveInside } from '../lib/paths';
import { passesThreshold, prometheusValue } from '../lib/metrics';
import { invalidateWorkspace } from '../lib/workspace';
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

export function markVerified(root: string, recordId: string, verified: boolean, actor: string, extra?: ManualExtra): VerifiedOutcome {
  const context = openRecord(root, recordId);
  if (!context) {
    return { ok: false, status: 404, code: 'record_not_found', message: `Записи \`${recordId}\` в проекте нет` };
  }
  if (context.record.type !== 'verification') {
    return { ok: false, status: 409, code: 'not_a_verification', message: `${recordId} — не проверка: отметка «Проверено» ставится на проверках` };
  }
  // Вид не ограничивает приёмку (ADR-0029), но у автоматических видов ручной прогон
  // не должен выдавать себя за прогон сборки: нужна заметка и честная пометка вида.
  const rawKind = context.record.data['kind'];
  const autoKind = isManualKind(rawKind) ? '' : (typeof rawKind === 'string' && rawKind.trim() ? rawKind.trim() : 'без вида');
  if (verified && autoKind && !(extra?.note ?? '').trim()) {
    return { ok: false, status: 400, code: 'note_required', message: 'Принимая проверку без прогона сборки, напишите, что проверено' };
  }
  // Шаги берутся из тела проверки; человек может отметить шаг проваленным (R-0061).
  const stepStates = extra?.steps ?? [];
  const steps: ReportStep[] = parseCheckSteps(context.record.body).map((step, i) => ({ ...step, state: stepStates[i]?.state ?? 'passed' }));
  const withSteps: ManualExtra | undefined = steps.length ? { ...extra, steps } : extra;
  const withKind: ManualExtra | undefined = autoKind ? { ...withSteps, kind: autoKind } : withSteps;

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
  writeFileSync(join(dir, name), manualReportText(recordId, state, actor, now, verified ? withKind : (extra?.login ? { login: extra.login } : undefined)), 'utf8');
  dropCache(root);
  invalidateWorkspace(root);

  // Журнал — след для человека. Сторож отказал — отметка всё равно поставлена.
  const outcome = applyJournalNote(context.original, {
    action: verifiedJournalAction(verified, actor, withKind),
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

export type RunOutcome =
  | { ok: true; report: string; total: number; failed: number }
  | { ok: false; status: number; code: string; message: string };

/** Прогон набора проверок на сборке (R-0062): один отчёт с полем `build` на весь набор. */
export function recordRun(root: string, build: string, results: Record<string, 'passed' | 'failed' | 'skipped'>, actor: string, extra?: { by?: string; note?: string; login?: string }): RunOutcome {
  if (!build.trim()) return { ok: false, status: 400, code: 'build_required', message: 'Не названа сборка или релиз' };
  const ids = Object.keys(results);
  if (ids.length === 0) return { ok: false, status: 400, code: 'run_empty', message: 'В прогоне нет ни одной проверки' };
  const index = loadIndex(root, true);
  const unknown = ids.filter((id) => !index.records.some((record) => record.id === id && record.type === 'verification'));
  if (unknown.length) return { ok: false, status: 404, code: 'record_not_found', message: `Не проверки или нет в проекте: ${unknown.join(', ')}` };
  const testsFolder = openRecord(root, ids[0] ?? '')?.workspace.manifest.paths?.tests;
  if (!testsFolder) return { ok: false, status: 409, code: 'tests_not_configured', message: 'В манифесте не назван раздел `paths.tests`: отчёту некуда лечь' };
  const now = new Date();
  const dir = resolveInside(root, join(DEVELOPMENT_DIR, testsFolder, 'reports'));
  mkdirSync(dir, { recursive: true });
  const base = runReportName(build, now);
  let name = base;
  for (let n = 2; existsSync(join(dir, name)); n += 1) name = base.replace(/\.json$/, `-${n}.json`);
  writeFileSync(join(dir, name), runReportText(build, results, actor, now, extra), 'utf8');
  dropCache(root);
  invalidateWorkspace(root);
  return { ok: true, report: name, total: ids.length, failed: Object.values(results).filter((state) => state === 'failed').length };
}

export type MetricOutcome =
  | { ok: true; state: 'passed' | 'failed' | 'skipped'; value: number | null; report: string; note: string }
  | { ok: false; status: number; code: string; message: string };

/**
 * Прогон проверки-метрики (R-0066): значение берётся запросом Prometheus
 * (`DOCDD_PROMETHEUS_URL`), порог — из front matter проверки. Нет адреса или
 * запроса или сервис не ответил — честное `skipped`, а не выдуманный успех.
 */
export async function runMetricCheck(root: string, recordId: string, actor: string): Promise<MetricOutcome> {
  const context = openRecord(root, recordId);
  if (!context) return { ok: false, status: 404, code: 'record_not_found', message: `Записи \`${recordId}\` в проекте нет` };
  const data = context.record.data;
  if (context.record.type !== 'verification' || data['kind'] !== 'metric') {
    return { ok: false, status: 409, code: 'not_a_metric', message: `${recordId} — не проверка вида metric` };
  }
  const query = typeof data['query'] === 'string' ? data['query'].trim() : '';
  const threshold = typeof data['threshold'] === 'number' ? data['threshold'] : Number.NaN;
  if (!query || !Number.isFinite(threshold)) {
    return { ok: false, status: 409, code: 'metric_not_configured', message: 'У проверки нет `query` или числового `threshold` в front matter' };
  }

  let state: 'passed' | 'failed' | 'skipped' = 'skipped';
  let value: number | null = null;
  let note = '';
  const base = (process.env['DOCDD_PROMETHEUS_URL'] ?? '').trim().replace(/\/+$/, '');
  if (!base) {
    note = 'Пропущено: не задан DOCDD_PROMETHEUS_URL';
  } else {
    try {
      const response = await fetch(`${base}/api/v1/query?query=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(10_000) });
      value = response.ok ? prometheusValue(await response.json()) : null;
      if (value === null) note = `Пропущено: Prometheus не вернул значения (HTTP ${response.status})`;
      else {
        state = passesThreshold(value, threshold, data['operator']) ? 'passed' : 'failed';
        note = `${query} = ${value}, порог ${data['operator'] === 'gte' ? '>=' : '<='} ${threshold}`;
      }
    } catch (error) {
      note = `Пропущено: Prometheus недоступен (${error instanceof Error ? error.message : String(error)})`;
    }
  }

  const run = recordRun(root, `metric-${recordId}`, { [recordId]: state }, actor, { note: note.slice(0, 300) });
  if (!run.ok) return run;
  return { ok: true, state, value, report: run.report, note };
}
