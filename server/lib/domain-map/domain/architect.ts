import { AREA_TITLE, isArchitectArea } from './model';

/**
 * Решения архитектора (R-0120, A-0004): топологию, хранение данных и транзакции
 * подтверждает только роль `architect`. Без входа (личный режим) роль одна —
 * сам человек, и правило молчит.
 */
export interface ArchitectRefusal {
  code: 'architect_only';
  message: string;
}

export function architectRefusal(
  record: { id: string; type: string; data: Record<string, unknown> },
  status: string,
  /** Роли вошедшего в проекте; `null` — вход выключен. */
  roles: readonly string[] | null
): ArchitectRefusal | null {
  if (roles === null || status !== 'approved' || record.type !== 'decision') return null;
  const area = record.data['area'];
  if (!isArchitectArea(area) || roles.includes('architect')) return null;
  return {
    code: 'architect_only',
    message: `Решение ${record.id} — об области «${AREA_TITLE[area]}»: подтверждает только архитектор. Ваши роли: ${roles.join(', ') || '—'}.`
  };
}
