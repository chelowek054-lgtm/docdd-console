import { AUTO_STEPS, checklist, type StepId } from '../lib/onboarding';

import { collectOnboarding } from './onboarding-service';

/**
 * «Запустить подключение» (R-0075): автоматические шаги выполняются сразу, шаги с моделью
 * и человеком — только называются со ссылкой на экран. Каждый шаг перезапускаемый: ничего
 * не перетирает, а дописывает недостающее и даёт черновики (подтверждает человек).
 * Обработчики шагов регистрируются сюда (`registerStep`) — по одному на задачу подключения.
 */

export interface StepResult {
  step: StepId;
  /** Что сделано словами: «найдено 3 папки», «заведено 5 черновиков». */
  summary: string;
  /** Сколько файлов или записей появилось; 0 — ничего нового. */
  created: number;
  ok: boolean;
}

export type StepHandler = (root: string) => Promise<Omit<StepResult, 'step'>> | Omit<StepResult, 'step'>;

const handlers = new Map<StepId, StepHandler>();

export function registerStep(id: StepId, handler: StepHandler): void {
  handlers.set(id, handler);
}

export interface RunOutcome {
  ran: StepResult[];
  /** Шаги без обработчика или не для приложения: человеку или модели. */
  left: { step: StepId; via: string; to: string }[];
}

/** Выполняет автоматические шаги, что ещё не готовы; `force` — и готовые тоже (перезапуск). */
export async function runOnboarding(root: string, options: { force?: boolean; only?: StepId } = {}): Promise<RunOutcome> {
  const steps = checklist(collectOnboarding(root));
  const ran: StepResult[] = [];
  const left: RunOutcome['left'] = [];
  for (const step of steps) {
    if (options.only && step.id !== options.only) continue;
    const auto = AUTO_STEPS.includes(step.id);
    const handler = handlers.get(step.id);
    if (!auto || !handler) { if (step.status !== 'done') left.push({ step: step.id, via: step.via, to: step.to }); continue; }
    if (step.status === 'done' && !options.force && !options.only) continue;
    try {
      ran.push({ step: step.id, ...(await handler(root)) });
    } catch (error) {
      ran.push({ step: step.id, ok: false, created: 0, summary: `не удалось: ${String(error)}` });
    }
  }
  return { ran, left };
}

export function hasHandler(id: StepId): boolean {
  return handlers.has(id);
}
