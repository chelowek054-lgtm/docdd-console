import { cutToBudget } from '../mcp';

/**
 * Проверка задачи вопросами (R-0117, A-0003): человек сверяет итог, не читая весь дифф. Ответы
 * только записываются: закрывает задачу человек, а вопросы составила модель, и судить по ним её
 * работу автоматически значило бы отдать решение ей.
 */
export const DIFF_BUDGET = 30_000;
export const MIN_QUESTIONS = 3;
export const MAX_QUESTIONS = 5;

export interface ReviewQuestion {
  text: string;
  how: string;
  expected: string;
}

export type ReviewVerdict = 'yes' | 'no' | 'unchecked';

export interface ReviewAnswer extends ReviewQuestion {
  verdict: ReviewVerdict;
  comment?: string;
}

export type ParsedQuestions = { ok: true; questions: ReviewQuestion[] } | { ok: false; problem: string };

const BLOCK = /```docdd-review-questions[ \t]*\r?\n([\s\S]*?)```/;
const HEAD = /\r?\n---\r?\n/;
const EXPECTED = /^## Ожидаемый результат[ \t]*\r?$/m;
const VERDICTS: Record<ReviewVerdict, string> = { yes: 'да', no: 'нет', unchecked: 'не проверял' };

/** Текст раздела «Ожидаемый результат»: по нему и задаются вопросы. */
export function expectedResultOf(body: string): string {
  const found = EXPECTED.exec(body);
  if (!found) return '';
  const rest = body.slice(found.index + found[0].length);
  const next = /^##[ \t]/m.exec(rest);
  return (next ? rest.slice(0, next.index) : rest).trim();
}

export function reviewPrompt(template: string, input: { id: string; title: string; expected: string; context: string; diff: string }): string {
  const found = HEAD.exec(template);
  const body = found ? template.slice(found.index + found[0].length).trimStart() : template;
  const values: Record<string, string> = {
    'ЗАДАЧА': `${input.id} — ${input.title}`,
    'ОЖИДАЕМЫЙ': input.expected || 'В задаче нет раздела «Ожидаемый результат»: спрашивай по требованию и проверкам.',
    'КОНТЕКСТ': input.context.trim() || 'Контекста нет.',
    'ДИФФ': input.diff.trim() ? cutToBudget(input.diff, DIFF_BUDGET) : 'Диффа нет: работа шла вне консоли или уже слита. Спрашивай о том, что человек может проверить сам.'
  };
  return Object.entries(values).reduce((text, [marker, value]) => text.replace(`<!-- ${marker} -->`, () => value), body);
}

const line = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export function parseReviewQuestions(answer: string): ParsedQuestions {
  const raw = BLOCK.exec(answer)?.[1];
  if (raw === undefined) return { ok: false, problem: 'В ответе модели нет блока `docdd-review-questions`' };
  let parsed: { questions?: unknown } | null;
  try {
    parsed = JSON.parse(raw) as { questions?: unknown } | null;
  } catch (error) {
    return { ok: false, problem: `Блок \`docdd-review-questions\` не разбирается как JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  const listed = Array.isArray(parsed?.questions) ? (parsed.questions as Record<string, unknown>[]) : [];
  const questions = listed
    .map((item) => ({ text: line(item?.['text']), how: line(item?.['how']), expected: line(item?.['expected']) }))
    .filter((item) => item.text && item.how && item.expected)
    .slice(0, MAX_QUESTIONS);
  if (questions.length < MIN_QUESTIONS) {
    return { ok: false, problem: `Модель дала вопросов: ${questions.length}. Нужно от ${MIN_QUESTIONS} до ${MAX_QUESTIONS}, у каждого — что проверить, как и какой ответ ожидаем` };
  }
  return { ok: true, questions };
}

/** Что пришло от браузера: только ответы с текстом вопроса и известным вердиктом. */
export function usableAnswers(raw: unknown): ReviewAnswer[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).flatMap((item): ReviewAnswer[] => {
    const verdict = item?.['verdict'];
    const text = line(item?.['text']);
    if (!text || (verdict !== 'yes' && verdict !== 'no' && verdict !== 'unchecked')) return [];
    const comment = line(item['comment']);
    return [{ text, how: line(item['how']), expected: line(item['expected']), verdict, ...(comment ? { comment } : {}) }];
  });
}

export function answersThread(answers: readonly ReviewAnswer[]): string {
  const parts = answers.map((answer, at) => [
    `${at + 1}. ${answer.text} — **${VERDICTS[answer.verdict]}**`,
    answer.how ? `   Как проверить: ${answer.how}` : '',
    answer.expected ? `   Ожидалось: ${answer.expected}` : '',
    answer.comment ? `   Комментарий: ${answer.comment}` : ''
  ].filter(Boolean).join('\n'));
  return ['Проверка вопросами', '', ...parts].join('\n');
}

export function answersSummary(answers: readonly ReviewAnswer[]): string {
  const count = (verdict: ReviewVerdict) => answers.filter((answer) => answer.verdict === verdict).length;
  return `проверка вопросами: да ${count('yes')}, нет ${count('no')}, не проверял ${count('unchecked')}`;
}

/** Текст доработки: что именно не сошлось. Пусто — дорабатывать по ответам нечего. */
export function reworkText(answers: readonly ReviewAnswer[]): string {
  const failed = answers.filter((answer) => answer.verdict === 'no');
  if (!failed.length) return '';
  return [
    'На проверке человек ответил «нет»:',
    ...failed.map((answer) => `- ${answer.text} Ожидалось: ${answer.expected}${answer.comment ? ` Комментарий: ${answer.comment}` : ''}`)
  ].join('\n');
}
