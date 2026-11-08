import { GRILL_THEMES, themeTitle } from './themes';

/**
 * Сессия допроса — обычная заметка во входящем (A-0003): вопросы и ответы читаются глазами, а
 * состояние лежит одной строкой JSON в конце файла. Разбор идёт только по ней: текст выше может
 * содержать что угодно из ответов человека, и искать в нём структуру значило бы гадать.
 */
export type GrillMode = 'new' | 'existing';

export interface GrillQuestion {
  id: string;
  theme: string;
  text: string;
  turn: number;
  /** Ответ дословно. Нет поля — вопрос ещё ждёт. */
  answer?: string;
  /** «Не знаю» или конец допроса без ответа: остаётся в списке, пока на него не ответят. */
  open?: boolean;
}

export interface GrillSession {
  version: 1;
  mode: GrillMode;
  status: 'open' | 'done';
  title: string;
  questions: GrillQuestion[];
  covered: string[];
}

export interface GrillAnswer {
  id: string;
  text: string;
}

const STATE_BLOCK = /```docdd-grill\r?\n(.*)\r?\n```\s*$/;
const NAME = /^grill-[^/\\]*\.md$/i;
const DONT_KNOW = /^(не знаю|незнаю|хз|пока не знаю|не решено|don'?t know|idk|\?+)[.!…]*$/i;

export const isSessionName = (name: string): boolean => NAME.test(name);

export function sessionFileName(now: Date): string {
  const stamp = now.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  return `grill-${stamp}.md`;
}

export function createSession(mode: GrillMode, title: string): GrillSession {
  return { version: 1, mode, status: 'open', title, questions: [], covered: [] };
}

export const waitingQuestions = (session: GrillSession): GrillQuestion[] =>
  session.questions.filter((question) => question.answer === undefined && !question.open);

export const openQuestions = (session: GrillSession): GrillQuestion[] =>
  session.questions.filter((question) => question.open === true);

export const pendingThemes = (session: GrillSession): string[] =>
  GRILL_THEMES.filter((theme) => !session.covered.includes(theme.id)).map((theme) => theme.id);

/** Ответы ложатся дословно. Пустой не считается: вопрос остаётся ждать. На открытый вопрос можно ответить позже. */
export function applyAnswers(session: GrillSession, answers: readonly GrillAnswer[]): GrillSession {
  const byId = new Map(answers.map((answer) => [answer.id, answer.text.trim()]));
  return {
    ...session,
    questions: session.questions.map((question) => {
      const text = byId.get(question.id);
      if (!text) return question;
      const rest: GrillQuestion = { ...question };
      delete rest.open;
      return DONT_KNOW.test(text) ? { ...rest, answer: text, open: true } : { ...rest, answer: text };
    })
  };
}

const nextTurn = (session: GrillSession): number => Math.max(0, ...session.questions.map((question) => question.turn)) + 1;

export function addTurn(session: GrillSession, turn: { questions: readonly { theme: string; text: string }[]; covered: readonly string[] }): GrillSession {
  const number = nextTurn(session);
  const added = turn.questions.map((question, at): GrillQuestion => ({
    id: `q${session.questions.length + at + 1}`,
    theme: question.theme,
    text: question.text,
    turn: number
  }));
  return {
    ...session,
    questions: [...session.questions, ...added],
    covered: [...new Set([...session.covered, ...turn.covered])]
  };
}

/** Конец допроса, в том числе ранний: всё, на что нет ответа, становится открытым вопросом, а не догадкой. */
export function finishSession(session: GrillSession): GrillSession {
  if (session.status === 'done') return session;
  const number = nextTurn(session);
  const asked = session.questions.map((question) => (question.answer === undefined ? { ...question, open: true } : question));
  const left = GRILL_THEMES.filter((theme) => !session.covered.includes(theme.id)).map((theme, at): GrillQuestion => ({
    id: `q${asked.length + at + 1}`,
    theme: theme.id,
    text: `Тема не закрыта: ${theme.asks}`,
    turn: number,
    open: true
  }));
  return { ...session, status: 'done', questions: [...asked, ...left] };
}

function questionLines(question: GrillQuestion): string[] {
  const lines = [`**В:** ${question.text}`, ''];
  if (question.answer !== undefined) lines.push(`**О:** ${question.answer}`, '');
  if (question.open) lines.push('_Вопрос открыт._', '');
  return lines;
}

export function serializeSession(session: GrillSession): string {
  const lines = [
    `# ${session.title}`,
    '',
    session.mode === 'new' ? 'Новый проект.' : 'Подключение готового проекта.',
    session.status === 'done' ? 'Допрос завершён.' : 'Допрос идёт.',
    ''
  ];
  const themes = [...new Set(session.questions.map((question) => question.theme))];
  for (const theme of themes) {
    lines.push(`## ${themeTitle(theme)}`, '');
    for (const question of session.questions.filter((item) => item.theme === theme)) lines.push(...questionLines(question));
  }
  const open = openQuestions(session);
  if (open.length) lines.push('## Открытые вопросы', '', ...open.map((question) => `- ${question.text}`), '');
  const pending = pendingThemes(session);
  if (session.status === 'open' && pending.length) lines.push('## Незакрытые темы', '', ...pending.map((id) => `- ${themeTitle(id)}`), '');
  lines.push('<!-- Блок ниже ведёт приложение: по нему продолжается допрос. -->', '```docdd-grill', JSON.stringify(session), '```', '');
  return lines.join('\n');
}

const isQuestion = (value: unknown): boolean => {
  const item = value as Partial<GrillQuestion> | null;
  return typeof item?.id === 'string' && typeof item.theme === 'string' && typeof item.text === 'string';
};

/** Файл правят и руками: что не сошлось с формой, сессией не считается, и файл остаётся обычной заметкой. */
export function parseSession(text: string): GrillSession | null {
  const raw = STATE_BLOCK.exec(text)?.[1];
  if (!raw) return null;
  try {
    const state = JSON.parse(raw) as Partial<GrillSession>;
    const shaped = (state.mode === 'new' || state.mode === 'existing')
      && (state.status === 'open' || state.status === 'done')
      && Array.isArray(state.questions) && state.questions.every(isQuestion)
      && Array.isArray(state.covered);
    return shaped ? (state as GrillSession) : null;
  } catch {
    return null;
  }
}

/** Заметка без служебного блока: вопросы и ответы модель получает текстом, платить за них дважды незачем. */
export function readableNote(text: string): string {
  const found = STATE_BLOCK.exec(text);
  if (!found) return text;
  return text.slice(0, found.index).replace(/<!-- Блок ниже ведёт приложение[^\n]*-->\s*$/, '').trimEnd() + '\n';
}

/** Незавершённый допрос в общий разбор входящего не идёт: заводить записи из него рано. */
export const isOpenSessionNote = (text: string): boolean => parseSession(text)?.status === 'open';

/** Уточнения к намерению (R-0116) дописываются к заметке: разбор и человек видят их в одном месте. */
export function appendClarifications(note: string, answers: readonly { text: string; answer: string }[]): string {
  const said = answers.filter((item) => item.answer.trim());
  if (!said.length) return note;
  const lines = said.flatMap((item) => [`**В:** ${item.text}`, '', `**О:** ${item.answer.trim()}`, '']);
  return `${note.trimEnd()}\n\n## Уточнения\n\n${lines.join('\n')}`;
}

/** Каждая запись ведёт к заметке сессии: журнал получит строку «заведена из…» (R-0115). */
export function withSessionNote<T extends { notes?: string[] }>(records: readonly T[], path: string): T[] {
  return records.map((record) => ({ ...record, notes: [...new Set([...(record.notes ?? []), path])] }));
}
