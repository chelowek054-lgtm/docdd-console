import { isThemeId, OTHER_THEME } from './themes';

export const TURN_LIMIT = 5;
export const INTENT_LIMIT = 3;

export type ParsedTurn =
  | { ok: true; questions: { theme: string; text: string }[]; covered: string[]; done: boolean }
  | { ok: false; problem: string };

const TURN_BLOCK = /```docdd-grill-turn[ \t]*\r?\n([\s\S]*?)```/;

/**
 * Ответ модели на ход допроса. Непонятный ответ — не авария: сессия остаётся как была, и человек
 * повторяет запрос. Лишние вопросы отрезаем: предел хода защищает человека, а не формат.
 */
export function parseTurn(answer: string, limit = TURN_LIMIT): ParsedTurn {
  const raw = TURN_BLOCK.exec(answer)?.[1];
  if (raw === undefined) return { ok: false, problem: 'В ответе модели нет блока `docdd-grill-turn`' };
  let parsed: { questions?: unknown; covered?: unknown; done?: unknown } | null;
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch (error) {
    return { ok: false, problem: `Блок \`docdd-grill-turn\` не разбирается как JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (parsed === null || typeof parsed !== 'object') return { ok: false, problem: 'Блок `docdd-grill-turn` — не объект' };
  const listed = Array.isArray(parsed.questions) ? (parsed.questions as { theme?: unknown; text?: unknown }[]) : [];
  const questions = listed
    .filter((item) => typeof item?.text === 'string' && item.text.trim() !== '')
    .slice(0, limit)
    .map((item) => ({
      theme: typeof item.theme === 'string' && isThemeId(item.theme) ? item.theme : OTHER_THEME,
      text: (item.text as string).trim()
    }));
  const covered = Array.isArray(parsed.covered) ? parsed.covered.filter((id): id is string => typeof id === 'string' && isThemeId(id)) : [];
  const done = parsed.done === true;
  if (!questions.length && !done) return { ok: false, problem: 'Модель не задала вопросов и не сказала, что допрос окончен' };
  return { ok: true, questions, covered, done };
}
