import type { GrillQuestion, GrillSession } from './session';
import { pendingThemes } from './session';
import { GRILL_THEMES, themeTitle } from './themes';

const FRONT_NOTE = /\r?\n---\r?\n/;
const LF = '\n';

/** Шапка шаблона — объяснение для человека, модели она не нужна. */
function withoutHead(template: string): string {
  const found = FRONT_NOTE.exec(template);
  return found ? template.slice(found.index + found[0].length).trimStart() : template;
}

function fill(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((text, [marker, value]) => text.replace(`<!-- ${marker} -->`, () => value), withoutHead(template));
}

const said = (question: GrillQuestion): string => [
  `- [${themeTitle(question.theme)}] ${question.text}`,
  question.answer === undefined ? '  Ответа нет.' : `  Ответ человека: ${question.answer}`,
  question.open ? '  Вопрос открыт: не переспрашивай, пока не появятся новые сведения.' : ''
].filter(Boolean).join(LF);

export function grillPrompt(
  template: string,
  session: GrillSession,
  known: readonly { id: string; type: string; title: string }[] = []
): string {
  const records = known.map((record) => `- \`${record.id}\` (${record.type}) ${record.title}`).join(LF) || 'Записей нет.';
  return fill(template, {
    'РЕЖИМ': session.mode === 'existing'
      ? `Проект уже существует. Сначала прочитай его документы и код: спрашивай только о том, чего в них нет или что в них расходится. Тему, на которую ответ уже есть в файлах, отметь закрытой и не спрашивай. Файлов не меняй.${LF}${LF}Записи проекта:${LF}${records}`
      : 'Проект новый: документов и кода ещё нет. Всё узнаёшь из ответов человека.',
    'ТЕМЫ': GRILL_THEMES.map((theme) => `- \`${theme.id}\` — ${theme.title}: ${theme.asks}`).join(LF),
    'ДИАЛОГ': session.questions.length ? session.questions.map(said).join(LF) : 'Вопросов ещё не было: это первый ход.',
    'НЕЗАКРЫТЫЕ': pendingThemes(session).map((id) => `\`${id}\``).join(', ') || 'Все темы закрыты.'
  });
}

export function intentPrompt(
  template: string,
  note: string,
  vision: { problem?: string; audience?: string; outcome?: string; not?: string } | null
): string {
  const line = vision ? [vision.problem, vision.audience, vision.outcome, vision.not ? `Не делает: ${vision.not}` : ''].filter(Boolean).join(LF) : '';
  return fill(template, { 'НАМЕРЕНИЕ': note.trim(), 'ВЕКТОР': line || 'Вектор проекта не записан.' });
}

export const grillPlanBlock = (template: string): string => withoutHead(template);
