import { batchPlan } from '../../server/lib/inventory';

/**
 * Ход «Описать пачками» (docs/07-maps.md, «Описать всё пачками»): заходы один за
 * другим, остановка на первом отказе. Чистая функция — сами запросы к серверу и
 * модели передаются снаружи, поэтому порядок и условия остановки проверяются без
 * сети и без токенов.
 */

export type BatchStep =
  | { ok: true; draft: string; count: number }
  /** `empty` — очередь кончилась: это конец работы, а не отказ. */
  | { ok: false; reason: string; empty?: boolean };

export interface BatchRun {
  /** Сколько заходов задумано до начала. */
  planned: number;
  /** Сколько прошло успешно. */
  done: number;
  /** Сколько файлов названо в успешных заходах. */
  files: number;
  /** Черновики карт, которые остались после прогона. */
  drafts: string[];
  /** Почему остановились; `null` — дошли до конца. */
  reason: string | null;
}

export async function describeBatch(input: {
  size: number;
  total: number;
  left: number;
  /** Один заход: пропустить `skip` файлов очереди, взять `limit`. */
  step: (skip: number, limit: number) => Promise<BatchStep>;
  stopped: () => boolean;
  /** Сколько заходов уже сделано — для строки прогресса. */
  onProgress?: (run: BatchRun) => void;
}): Promise<BatchRun> {
  const plan = batchPlan(input.left, input.size, input.total);
  const run: BatchRun = { planned: plan.steps, done: 0, files: 0, drafts: [], reason: null };

  for (let at = 0; at < plan.steps; at += 1) {
    if (input.stopped()) {
      run.reason = 'остановлено вручную';
      break;
    }
    const skip = at * input.size;
    const limit = Math.min(input.size, plan.files - skip);
    const result = await input.step(skip, limit);
    if (!result.ok) {
      // Очередь кончилась раньше потолка — не отказ, а конец работы.
      if (!result.empty) run.reason = `${result.reason} (заход ${at + 1})`;
      break;
    }
    run.done += 1;
    run.files += result.count;
    run.drafts.push(result.draft);
    input.onProgress?.({ ...run });
    // Остановили во время запроса: этот заход уже записан, следующий не начинаем.
    if (input.stopped() && at + 1 < plan.steps) {
      run.reason = 'остановлено вручную';
      break;
    }
  }
  return run;
}
