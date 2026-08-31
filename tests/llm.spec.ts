import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { fixPrompt, mapsPrompt, ISSUES_MARKER, STATE_MARKER } from '../server/lib/prompt';
import type { IssueDto } from '../server/lib/types';
import { ask, unfence, type Runner } from '../server/utils/llm';

/**
 * Модуль доступа к модели и сборка запросов. Настоящий вызов здесь не делается
 * ни разу: он стоит денег и времени, а проверять надо разбор ответа, отказы и
 * то, что в запрос попало (docs/adr/0008-llm-through-claude-code.md).
 */

const root = fileURLToPath(new URL('..', import.meta.url));
const fixTemplate = readFileSync(join(root, 'docs', 'prompts', 'fix-violations.md'), 'utf8');
const mapsTemplate = readFileSync(join(root, 'docs', 'prompts', 'update-maps.md'), 'utf8');

const issue = (over: Partial<IssueDto> = {}): IssueDto => ({
  severity: 'error',
  code: 'task_no_requirement',
  recordId: 'T-0007',
  path: 'docs/development/tasks/T-0007-a.md',
  message: 'Задача T-0007 не выполняет ни одного требования.',
  ...over
});

const answering = (stdout: string, code = 0): Runner =>
  () => Promise.resolve({ stdout, stderr: '', code });

describe('ask', () => {
  it('отдаёт ответ модели и время', async () => {
    const result = await ask('вопрос', { run: answering('ответ модели') });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.answer).toBe('ответ модели');
    expect(result.ms).toBeGreaterThanOrEqual(0);
  });

  it('передаёт текст на стандартный ввод, а не аргументом', async () => {
    let seen: { args: readonly string[]; input: string } | null = null;
    const run: Runner = (_command, args, input) => {
      seen = { args, input };
      return Promise.resolve({ stdout: 'готово', stderr: '', code: 0 });
    };

    await ask('длинный запрос', { run });
    // Аргументы фиксированы: от пользователя туда не попадает ничего.
    expect(seen!.args).toEqual(['-p']);
    expect(seen!.input).toBe('длинный запрос');
  });

  it('пустой ответ отличает от ответа', async () => {
    const result = await ask('вопрос', { run: answering('   ') });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('empty');
  });

  it('ненулевой код возврата без вывода — отказ с причиной', async () => {
    const result = await ask('вопрос', { run: answering('', 1) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('failed');
  });

  it('ответ, пришедший вместе с ненулевым кодом, не выбрасывается', async () => {
    // Программа могла поругаться в stderr и всё-таки ответить.
    const result = await ask('вопрос', { run: answering('всё же ответ', 1) });
    expect(result.ok).toBe(true);
  });

  it('зависший процесс становится отказом по времени, а не висит', async () => {
    const run: Runner = () => Promise.reject(new Error('spawn timed out after 1000 ms'));
    const result = await ask('вопрос', { run, timeoutMs: 1000 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('timeout');
    expect(result.failure.message).toContain('секунд');
  });

  it('сорванный запуск объясняется, а не роняет сервер', async () => {
    const run: Runner = () => Promise.reject(new Error('ENOENT'));
    const result = await ask('вопрос', { run });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('failed');
  });
});

describe('unfence', () => {
  it('достаёт содержимое из ограждения', () => {
    expect(unfence('текст\n```json\n{"a":1}\n```\nхвост')).toBe('{"a":1}');
  });

  it('берёт ограждение нужного языка', () => {
    const answer = '```json\n{"a":1}\n```\n\n```docdd-codemap\n{"b":2}\n```';
    expect(unfence(answer, 'docdd-codemap')).toBe('{"b":2}');
  });

  it('без ограждения отдаёт как есть', () => {
    expect(unfence('  просто ответ  ')).toBe('просто ответ');
  });
});

describe('fixPrompt', () => {
  it('подставляет нарушения вместо метки', () => {
    const prompt = fixPrompt(fixTemplate, [issue()]);
    expect(prompt).not.toContain(ISSUES_MARKER);
    expect(prompt).toContain('task_no_requirement');
    expect(prompt).toContain('docs/development/tasks/T-0007-a.md');
    expect(prompt).toContain('не выполняет ни одного требования');
  });

  it('различает ошибку и предупреждение словами', () => {
    const prompt = fixPrompt(fixTemplate, [issue(), issue({ severity: 'warning', code: 'task_stale' })]);
    expect(prompt).toContain('— ошибка');
    expect(prompt).toContain('— предупреждение');
  });

  it('не теряет границы запроса: они и делают ответ пригодным', () => {
    const prompt = fixPrompt(fixTemplate, [issue()]);
    expect(prompt).toContain('Не переписывай тело документов');
    expect(prompt).toContain('Не предлагай отключить правило');
  });

  it('пустой список не притворяется списком', () => {
    expect(fixPrompt(fixTemplate, [])).toContain('Нарушений нет.');
  });

  it('объяснение для человека в запрос не уходит', () => {
    // Шапка шаблона — про то, как приложение его использует; модели она не нужна.
    expect(fixPrompt(fixTemplate, [issue()])).not.toContain('Приложение подставляет сюда');
  });
});

describe('mapsPrompt', () => {
  const state = {
    from: [] as string[],
    modules: 0,
    sources: 0,
    screens: 0,
    unverified: [] as { label: string; path: string; line: number; verdict: string }[],
    code: ['server', 'app'],
    client: ['app']
  };

  it('на пустом проекте просит описать устройство целиком', () => {
    const prompt = mapsPrompt(mapsTemplate, state);
    expect(prompt).not.toContain(STATE_MARKER);
    expect(prompt).toContain('это первая карта проекта');
    expect(prompt).toContain('`server`, `app`');
  });

  it('на непустом просит описать изменение к сложенной картине', () => {
    const prompt = mapsPrompt(mapsTemplate, { ...state, from: ['M-0001'], modules: 61 });
    expect(prompt).toContain('Опиши **изменение**');
    expect(prompt).toContain('61 модулей');
  });

  it('называет то, что перестало сходиться: с этого и надо начинать', () => {
    const prompt = mapsPrompt(mapsTemplate, {
      ...state,
      from: ['M-0001'],
      unverified: [{ label: 'a.ts → b.ts', path: 'a.ts', line: 4, verdict: 'stale' }]
    });
    expect(prompt).toContain('Что перестало сходиться');
    expect(prompt).toContain('a.ts → b.ts');
    expect(prompt).toContain('`a.ts`:4');
  });

  it('длинный список обрезает и говорит, сколько ещё', () => {
    const many = Array.from({ length: 45 }, (_, at) => ({
      label: `edge-${at}`, path: 'a.ts', line: at + 1, verdict: 'stale'
    }));
    const prompt = mapsPrompt(mapsTemplate, { ...state, from: ['M-0001'], unverified: many });
    expect(prompt).toContain('и ещё 5');
  });

  it('требование свидетельств из запроса не пропадает', () => {
    expect(mapsPrompt(mapsTemplate, state)).toContain('Свидетельство обязательно');
  });
});
