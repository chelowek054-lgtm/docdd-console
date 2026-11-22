/**
 * Подтверждение человеком, переданное моделью (A-0008, R-0133). Консоль не видит чат и не может
 * проверить, что вопрос был: действует доверие плюс след. Поэтому вопрос и ответ обязательны,
 * дословны и ложатся в журнал — подделку видно по журналу и автору коммита.
 */
export interface Confirmation {
  /** Кто ответил: логин участника команды или имя человека. */
  by: string;
  question: string;
  answer: string;
}

export type ConfirmationParse =
  | { ok: true; confirmation: Confirmation | null }
  | { ok: false; message: string };

const LIMITS = { by: 80, question: 500, answer: 500 } as const;

/** Журнал — одна строка с разделителем « · »: перевод строки или разделитель внутри текста сломали бы её разбор. */
const oneLine = (text: string): string => text.replace(/\s+/g, ' ').replace(/·/g, '-').trim();

/** Нет поля — подтверждения нет; есть, но неполное — отказ: полуподтверждение хуже, чем никакого. */
export function parseConfirmation(value: unknown): ConfirmationParse {
  if (value === undefined || value === null) return { ok: true, confirmation: null };
  if (typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, message: 'Подтверждение — объект с полями by, question и answer' };
  }
  const raw = value as Record<string, unknown>;
  const fields = {} as Confirmation;
  for (const key of ['by', 'question', 'answer'] as const) {
    const text = typeof raw[key] === 'string' ? oneLine(raw[key] as string) : '';
    if (!text) return { ok: false, message: `В подтверждении пусто поле ${key}: нужен ${key === 'by' ? 'тот, кто ответил' : key === 'question' ? 'вопрос человеку' : 'дословный ответ человека'}` };
    if (text.length > LIMITS[key]) return { ok: false, message: `Поле ${key} в подтверждении длиннее ${LIMITS[key]} знаков` };
    fields[key] = text;
  }
  return { ok: true, confirmation: fields };
}

/** Подпись строки журнала: кто ответил, через кого, что спросили и что ответили. */
export function confirmationActor(actor: string, confirmation: Confirmation): string {
  const via = actor.trim() || 'модель';
  return `${confirmation.by} через ${via}, вопрос: «${confirmation.question}», ответ: «${confirmation.answer}»`;
}
