import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { agentVerdict } from '../server/lib/agents';
import { parseDiscussion } from '../server/lib/discussion';
import {
  answersSummary,
  answersThread,
  DIFF_BUDGET,
  expectedResultOf,
  parseReviewQuestions,
  reviewPrompt,
  reworkText,
  usableAnswers,
  type ReviewAnswer
} from '../server/lib/review-questions';
import { worktreePath } from '../server/lib/branch';
import { loadIndex } from '../server/utils/index-service';
import { reviewQuestionsPrompt, saveReviewAnswers } from '../server/utils/review-questions-service';

const TEMPLATE = readFileSync(join(__dirname, '..', 'docs', 'prompts', 'review-questions.md'), 'utf8');
const block = (questions: unknown) => `\`\`\`docdd-review-questions\n${JSON.stringify({ questions })}\n\`\`\``;
const question = (n: number) => ({ text: `Вопрос ${n}`, how: `Как ${n}`, expected: `Ждём ${n}` });
const ANSWERS: ReviewAnswer[] = [
  { ...question(1), verdict: 'yes' },
  { ...question(2), verdict: 'no', comment: 'Кнопки нет' },
  { ...question(3), verdict: 'unchecked' }
];

describe('Проверка вопросами: чистые функции (V-0126)', () => {
  it('разбор: 3–5 вопросов, лишние отрезаны, неполные не считаются', () => {
    const three = parseReviewQuestions(block([1, 2, 3].map(question)));
    expect(three.ok && three.questions).toHaveLength(3);
    const seven = parseReviewQuestions(block([1, 2, 3, 4, 5, 6, 7].map(question)));
    expect(seven.ok && seven.questions).toHaveLength(5);
    expect(parseReviewQuestions(block([question(1), question(2)])).ok).toBe(false);
    expect(parseReviewQuestions(block([question(1), question(2), { text: 'Без как' }])).ok).toBe(false);
    expect(parseReviewQuestions('нет блока').ok).toBe(false);
    expect(parseReviewQuestions('```docdd-review-questions\n{битый\n```').ok).toBe(false);
    expect(parseReviewQuestions('```docdd-review-questions\nnull\n```').ok).toBe(false);
  });

  it('раздел ожидаемого результата вынимается до следующего заголовка', () => {
    expect(expectedResultOf('Текст\n\n## Ожидаемый результат\n\nВсё работает.\n\n## Журнал\n\n- строка\n')).toBe('Всё работает.');
    expect(expectedResultOf('Текст\r\n\r\n## Ожидаемый результат\r\n\r\nВсё работает.\r\n')).toBe('Всё работает.');
    expect(expectedResultOf('Без раздела')).toBe('');
  });

  it('длинный дифф режется по бюджету, и об этом сказано сверху', () => {
    const diff = Array.from({ length: 5000 }, (_, at) => `+строка номер ${at} длинная длинная длинная`).join('\n');
    const prompt = reviewPrompt(TEMPLATE, { id: 'T-1', title: 'Задача', expected: 'Итог', context: 'Контекст', diff });
    expect(prompt).toContain('[отрезано:');
    expect(prompt.length).toBeLessThan(DIFF_BUDGET + 3000);
    expect(prompt).not.toContain('<!--');
    expect(prompt).not.toContain('Приложение подставляет');
  });

  it('из браузера берутся только ответы с вопросом и известным вердиктом', () => {
    expect(usableAnswers('x')).toEqual([]);
    expect(usableAnswers([{ text: 'В', verdict: 'может быть' }, { verdict: 'yes' }, null, { text: 'В', how: 'К', expected: 'Ж', verdict: 'yes', comment: ' ' }]))
      .toEqual([{ text: 'В', how: 'К', expected: 'Ж', verdict: 'yes' }]);
  });

  it('итог, обсуждение и текст доработки', () => {
    expect(answersSummary(ANSWERS)).toBe('проверка вопросами: да 1, нет 1, не проверял 1');
    const thread = answersThread(ANSWERS);
    expect(thread).toContain('Вопрос 2 — **нет**');
    expect(thread).toContain('Комментарий: Кнопки нет');
    const rework = reworkText(ANSWERS);
    expect(rework).toContain('Вопрос 2');
    expect(rework).toContain('Кнопки нет');
    expect(rework).not.toContain('Вопрос 1');
    expect(reworkText([ANSWERS[0]!])).toBe('');
  });

  it('агент на своей задаче получает отказ, на чужой — нет', () => {
    const records = [{ id: 'T-1', type: 'task', links: {}, extra: { assignee: 'dev-agent' } }, { id: 'T-2', type: 'task', links: {}, extra: { assignee: 'other' } }] as unknown as Parameters<typeof agentVerdict>[4];
    expect(agentVerdict('dev-agent', 'POST', '/api/projects/p/records/T-1/review-answers', {}, records)).toMatchObject({ allowed: false, code: 'agent_own_acceptance' });
    expect(agentVerdict('dev-agent', 'POST', '/api/projects/p/records/T-2/review-answers', {}, records).allowed).toBe(true);
  });
});

describe('Проверка вопросами на временном проекте (V-0126)', () => {
  let root: string;
  const dev = () => join(root, 'docs', 'development');

  const write = (dir: string, id: string, front: string, body: string) => {
    mkdirSync(join(dev(), dir), { recursive: true });
    writeFileSync(join(dev(), dir, `${id}.md`), `---\nid: ${id}\n${front}\ncreated: 2026-11-08\nupdated: 2026-11-08\n---\n\n# ${id}\n\n${body}\n\n## Журнал\n\n- 2026-11-08 · заведена · человек\n`);
  };

  const task = (status: string, extra = '') => write('tasks', 'T-0001', `type: task\ntitle: Задача один\nstatus: ${status}\nchange: fix\n${extra}links:\n  implements: [R-0001]\n  decided_by: [D-0001]`, 'Сделать.\n\n## Ожидаемый результат\n\nВрач видит список приёмов.');

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'docdd-review-'));
    mkdirSync(dev(), { recursive: true });
    writeFileSync(join(dev(), 'project.yaml'), 'contract: docdd.workspace/1\nproject:\n  id: p\n  name: P\npaths:\n  requirements: requirements\n  tests: tests\n  tasks: tasks\n  decisions: decisions\n  design: design\n  maps: maps\n');
    write('requirements', 'R-0001', 'type: requirement\ntitle: Список приёмов\nstatus: approved\nlinks:\n  verified_by: [V-0001]', 'Текст требования про приёмы.');
    write('tests', 'V-0001', 'type: verification\ntitle: Проверка списка\nstatus: approved\nkind: manual\nlinks:\n  verifies: [R-0001]', 'Шаги проверки списка.');
    write('decisions', 'D-0001', 'type: decision\ntitle: Закрытое решение\nstatus: approved\ntags: [confidential]', 'СЕКРЕТНАЯ ЦЕНА КОНТРАКТА');
  });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  it('доступно только у задачи на проверке', async () => {
    task('in_progress');
    expect(await reviewQuestionsPrompt(root, 'T-0001', TEMPLATE)).toMatchObject({ ok: false, status: 409, code: 'task_not_in_review' });
    expect(saveReviewAnswers(root, 'T-0001', ANSWERS, 'Боб')).toMatchObject({ ok: false, code: 'task_not_in_review' });
    expect(await reviewQuestionsPrompt(root, 'R-0001', TEMPLATE)).toMatchObject({ ok: false, code: 'task_not_in_review' });
    expect(await reviewQuestionsPrompt(root, 'T-9999', TEMPLATE)).toMatchObject({ ok: false, status: 404 });
  });

  it('запрос: ожидаемый результат, требование, проверка; закрытого нет', async () => {
    task('in_review');
    const built = await reviewQuestionsPrompt(root, 'T-0001', TEMPLATE);
    if (!built.ok) throw new Error(built.message);
    expect(built.prompt).toContain('Врач видит список приёмов.');
    expect(built.prompt).toContain('Текст требования про приёмы.');
    expect(built.prompt).toContain('Шаги проверки списка.');
    expect(built.prompt).toContain('Диффа нет');
    expect(built.prompt).not.toContain('СЕКРЕТНАЯ ЦЕНА');
  });

  it('запрос несёт дифф ветки задачи', async () => {
    task('in_review');
    const git = (...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: root, stdio: 'pipe' });
    writeFileSync(join(root, 'a.txt'), 'старое\n');
    git('init', '-b', 'main');
    git('add', '.');
    git('commit', '-m', 'первый');
    const worktree = join(root, worktreePath('T-0001'));
    git('worktree', 'add', worktree, '-b', 'task/T-0001');
    writeFileSync(join(worktree, 'a.txt'), 'новая строка задачи'+String.fromCharCode(10));
    const built = await reviewQuestionsPrompt(root, 'T-0001', TEMPLATE);
    if (!built.ok) throw new Error(built.message);
    expect(built.prompt).toContain('новая строка задачи');
    expect(built.prompt).not.toContain('Диффа нет');
  });

  it('закрытую задачу модели не отдаём', async () => {
    task('in_review', 'tags: [confidential]\n');
    expect(await reviewQuestionsPrompt(root, 'T-0001', TEMPLATE)).toMatchObject({ ok: false, code: 'task_confidential' });
  });

  it('ответы — в обсуждении, итог — в журнале, статус не меняется', () => {
    task('in_review');
    const saved = saveReviewAnswers(root, 'T-0001', ANSWERS, 'Боб', new Date('2026-11-08T10:00:00Z'));
    expect(saved).toEqual({ ok: true, summary: 'проверка вопросами: да 1, нет 1, не проверял 1' });
    const file = readFileSync(join(dev(), 'tasks', 'T-0001.md'), 'utf8');
    expect(file).toContain('проверка вопросами: да 1, нет 1, не проверял 1 · Боб');
    expect(file).toContain('status: in_review');
    expect(loadIndex(root).records.find((record) => record.id === 'T-0001')?.status).toBe('in_review');
    const thread = parseDiscussion(readFileSync(join(dev(), 'tasks', 'T-0001.discussion.json'), 'utf8')).threads[0];
    expect(thread?.author).toBe('Боб');
    expect(thread?.text).toContain('Вопрос 2 — **нет**');
  });

  it('пустые ответы не пишутся', () => {
    task('in_review');
    expect(saveReviewAnswers(root, 'T-0001', [], 'Боб')).toMatchObject({ ok: false, code: 'answers_required' });
  });
});
