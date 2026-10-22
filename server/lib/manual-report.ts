/**
 * Ручная отметка «Проверено» (docs/02-workspace-contract.md, «Ручная отметка
 * „Проверено“»): человек проверил сам, и приложение фиксирует это тем же
 * отчётом, каким фиксируется любой прогон. Чистые функции — файл пишет вызывающий.
 */

/** Виды проверок, которые прогоняет человек: у остальных факт приходит от сборки. */
export const MANUAL_KINDS: readonly string[] = ['manual', 'review'];

export function isManualKind(kind: unknown): boolean {
  return typeof kind === 'string' && MANUAL_KINDS.includes(kind);
}

export type ManualState = 'passed' | 'skipped';

/** `manual:architect` — видно, что прогон ручной и кто его сделал. */
export function manualRunner(actor: string): string {
  return actor.trim() === '' ? 'manual' : `manual:${actor.trim()}`;
}

/**
 * Время в имени — до миллисекунд: отметка не затирает прежние, а снятие сразу
 * за постановкой не должно делить имя с ней.
 */
export function manualReportName(verificationId: string, now: Date): string {
  const iso = now.toISOString();
  const date = iso.slice(0, 10);
  const time = iso.slice(11, 23).replace(/[:.]/g, '');
  return `${date}-manual-${verificationId}-${time}.json`;
}

/** Кто проверил и что именно: необязательно, чтобы прежние вызовы жили как жили. */
export interface ManualExtra {
  by?: string | undefined;
  note?: string | undefined;
  /** Вид проверки, если она автоматическая: тогда ручная приёмка помечается честно. */
  kind?: string | undefined;
  /** Результат по шагам проверки (R-0061); нет — отчёт прежнего вида. */
  steps?: ReportStep[] | undefined; login?: string | undefined; // логин вошедшего: runner `manual:<логин>`, а не подпись
}

/** Сколько знаков заметки идёт в строку журнала: журнал — след, а не пересказ. */
export const NOTE_JOURNAL_LIMIT = 120;

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function manualReportText(verificationId: string, state: ManualState, actor: string, now: Date, extra?: ManualExtra): string {
  const by = extra?.by?.trim() ?? '';
  const note = extra?.note?.trim() ?? '';
  const kind = extra?.kind?.trim() ?? '';
  return JSON.stringify({
    contract: 'docdd.workspace/1',
    runner: manualRunner(extra?.login || actor),
    started_at: now.toISOString(),
    total: 1,
    failed: 0,
    ...(by ? { checked_by: by } : {}),
    ...(note ? { note } : {}),
    ...(kind ? { verification_kind: kind } : {}),
    ...(extra?.steps?.length ? { steps: extra.steps } : {}),
    verifications: { [verificationId]: state }
  }, null, 2) + '\n';
}

/**
 * Слова журнала записи проверки: «проверена вручную · <роль> · проверил <Имя> ·
 * <note>». Без аргументов — прежняя короткая подпись; снятие отметки имён не несёт.
 */
export function verifiedJournalAction(verified: boolean, actor = '', extra?: ManualExtra): string {
  if (!verified) return 'отметка «проверено» снята';
  const by = oneLine(extra?.by ?? '');
  const note = oneLine(extra?.note ?? '');
  const short = note.length > NOTE_JOURNAL_LIMIT ? `${note.slice(0, NOTE_JOURNAL_LIMIT - 1).trimEnd()}…` : note;
  const kind = extra?.kind?.trim() ?? '';
  return [kind ? `проверена вручную (вид ${kind})` : 'проверена вручную', actor.trim(), by ? `проверил ${by}` : '', short].filter(Boolean).join(' · ');
}

/** Шаг ручной проверки: что сделать и что должно получиться (R-0061). */
export interface CheckStep { text: string; expected?: string }
/** Шаг в отчёте: результат ставит человек. */
export interface ReportStep extends CheckStep { state: 'passed' | 'failed' }

/**
 * Шаги из раздела «## Шаги» тела проверки: пункты списка, «текст -> ожидаемое» или
 * «текст => ожидаемое». Раздела нет — шагов нет, прежние проверки живут как жили.
 * Общий «## Ожидаемый результат» приписывается последнему шагу без своего ожидания.
 */
export function parseCheckSteps(body: string): CheckStep[] {
  const steps: CheckStep[] = [];
  let section = '';
  let overall = '';
  for (const line of body.split(/\r?\n/)) {
    const heading = /^#{2,3}\s+(.+?)\s*$/.exec(line);
    if (heading) { section = (heading[1] ?? '').toLowerCase(); continue; }
    const item = /^\s*(?:\d+[.)]|[-*])\s+(.+?)\s*$/.exec(line);
    if (section === 'шаги' && item) {
      const [text, expected] = (item[1] ?? '').split(/\s*(?:=>|->|→)\s*/, 2);
      steps.push({ text: text ?? '', ...(expected ? { expected } : {}) });
    } else if (section === 'ожидаемый результат' && line.trim()) {
      overall = `${overall} ${line.replace(/^\s*[-*]\s+/, '').trim()}`.trim();
    }
  }
  const last = steps[steps.length - 1];
  if (last && !last.expected && overall) last.expected = overall;
  return steps;
}

/** Имя отчёта прогона набора на сборку: build в имени, чтобы прогоны разных сборок не затирались. */
export function runReportName(build: string, now: Date): string {
  const safe = build.trim().replace(/[^\p{L}\p{N}._-]+/gu, '-').slice(0, 40) || 'build';
  return `${now.toISOString().slice(0, 10)}-run-${safe}-${now.toISOString().slice(11, 23).replace(/[:.]/g, '')}.json`;
}

/**
 * Отчёт прогона набора проверок (R-0062): итог по каждой и общий (`total`, `failed`),
 * версия сборки — в `build`. Формат тот же, что у любого отчёта, поэтому читается как прежде.
 */
export type RunState = 'passed' | 'failed' | 'skipped' | 'blocked';

export function runReportText(build: string, results: Record<string, RunState>, actor: string, now: Date, extra?: { by?: string; note?: string; login?: string; reasons?: Record<string, string> }): string {
  const states = Object.values(results);
  return JSON.stringify({
    contract: 'docdd.workspace/1',
    runner: manualRunner(extra?.login || actor),
    started_at: now.toISOString(),
    build: build.trim(),
    total: states.length,
    failed: states.filter((state) => state === 'failed').length,
    ...(extra?.by?.trim() ? { checked_by: extra.by.trim() } : {}),
    ...(extra?.note?.trim() ? { note: extra.note.trim() } : {}),
    ...(extra?.reasons && Object.keys(extra.reasons).length ? { reasons: extra.reasons } : {}),
    verifications: results
  }, null, 2) + '\n';
}
