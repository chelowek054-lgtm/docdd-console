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

export function manualReportText(verificationId: string, state: ManualState, actor: string, now: Date): string {
  return JSON.stringify({
    contract: 'docdd.workspace/1',
    runner: manualRunner(actor),
    started_at: now.toISOString(),
    total: 1,
    failed: 0,
    verifications: { [verificationId]: state }
  }, null, 2) + '\n';
}

/** Слова журнала записи проверки. */
export function verifiedJournalAction(verified: boolean): string {
  return verified ? 'проверена вручную' : 'отметка «проверено» снята';
}
