import { parseConfirmation, type Confirmation } from '../domain/confirmation';

/**
 * Поля подтверждения у инструментов MCP (A-0008). Описание полей — инструкция модели:
 * сперва спросить человека в чате, потом передать вопрос и его ответ дословно.
 */
export const CONFIRM_PROPERTIES = {
  confirmed_by: { type: 'string', description: 'Кто из людей ответил «да»: логин участника команды или имя' },
  question: { type: 'string', description: 'Вопрос, который вы задали человеку в чате, дословно; в нём перечислены записи' },
  answer: { type: 'string', description: 'Ответ человека дословно. Без явного согласия инструмент не вызывать' }
} as const;

export const CONFIRM_REQUIRED = ['confirmed_by', 'question', 'answer'] as const;

/** Пустое или неполное подтверждение — ошибка с объяснением: модель видит, чего не хватило. */
export function confirmationFromArgs(args: Record<string, unknown>): Confirmation {
  const parsed = parseConfirmation({ by: args['confirmed_by'], question: args['question'], answer: args['answer'] });
  if (!parsed.ok) throw new Error(`${parsed.message}. Сперва спросите человека в чате и передайте его ответ дословно (A-0008)`);
  if (!parsed.confirmation) throw new Error('Нет подтверждения человека: спросите в чате и передайте вопрос и ответ');
  return parsed.confirmation;
}

/** Подтверждение в теле запроса API — под тем же именем, что ждут маршруты. */
export const confirmationBody = (confirmation: Confirmation) => ({ by: confirmation.by, question: confirmation.question, answer: confirmation.answer });
