import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { fixPrompt, mapsPrompt, ISSUES_MARKER, STATE_MARKER } from '../server/lib/prompt';
import type { IssueDto } from '../server/lib/types';
import { ask, availability, childEnvironment, spawnClaude, unfence, type Runner } from '../server/utils/llm';

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

  it('короткий запрос уходит аргументом: так его получит и оболочка', async () => {
    let seen: { args: readonly string[]; input: string } | null = null;
    const run: Runner = (_command, args, input) => {
      seen = { args, input };
      return Promise.resolve({ stdout: 'готово', stderr: '', code: 0 });
    };

    await ask('короткий запрос', { run });
    expect(seen!.args).toEqual(['-p', 'короткий запрос']);
    expect(seen!.input).toBe('');
  });

  it('длинный уходит на стандартный ввод: в аргумент он не влезет', async () => {
    let seen: { args: readonly string[]; input: string } | null = null;
    const run: Runner = (_command, args, input) => {
      seen = { args, input };
      return Promise.resolve({ stdout: 'готово', stderr: '', code: 0 });
    };

    const long = 'а'.repeat(30_000);
    await ask(long, { run });
    // Аргументы фиксированы: текста запроса среди них нет.
    expect(seen!.args).toEqual(['-p']);
    expect(seen!.input).toBe(long);
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

  it('отказ в доступе называется своим именем и советует, где чинить', async () => {
    const run: Runner = () => Promise.resolve({
      stdout: '',
      stderr: 'Failed to authenticate. API Error: 403 Request not allowed',
      code: 1
    });

    const result = await ask('вопрос', { run });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Отказ Claude Code — не поломка приложения, и путать их нельзя.
    expect(result.failure.code).toBe('unauthorized');
    expect(result.failure.message).toContain('claude -p');
    expect(result.failure.detail).toContain('403');
  });

  it('отказ, напечатанный в обычный вывод с нулевым кодом, не выдаётся за ответ модели', async () => {
    // Так Claude Code и отвечает на самом деле: строка отказа в stdout, код 0.
    const run: Runner = () => Promise.resolve({
      stdout: 'Failed to authenticate. API Error: 403 Request not allowed',
      stderr: '',
      code: 0
    });

    const result = await ask('вопрос', { run });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('unauthorized');
  });

  it('длинный ответ про 403 остаётся ответом: это разбор задачи, а не отказ', async () => {
    const text = 'Разбираем ошибку 403 Request not allowed: она означает отказ в доступе. ' + 'Проверьте вход и повторите. '.repeat(20);
    const result = await ask('вопрос', { run: answering(text, 0) });
    expect(result.ok).toBe(true);
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

  it('работает в названной папке: карта строится по коду проекта, а не сервера', async () => {
    let seen: string | undefined;
    const run: Runner = (_command, _args, _input, options) => {
      seen = options.cwd;
      return Promise.resolve({ stdout: 'готово', stderr: '', code: 0 });
    };

    await ask('вопрос', { run, cwd: 'D:/work/fishForecast' });
    expect(seen).toBe('D:/work/fishForecast');
  });

  it('переменные чужой сессии в потомка не уходят', async () => {
    let seen: NodeJS.ProcessEnv | undefined;
    const run: Runner = (_command, _args, _input, options) => {
      seen = options.env;
      return Promise.resolve({ stdout: 'готово', stderr: '', code: 0 });
    };

    await ask('вопрос', { run });
    // Иначе программа попробует взять доступ у сессии-родителя и получит 403.
    expect(Object.keys(seen ?? {}).some((name) => /^CLAUDE_CODE_/.test(name))).toBe(false);
    expect(seen?.['CLAUDECODE']).toBeUndefined();
  });

  it('сорванный запуск объясняется, а не роняет сервер', async () => {
    const run: Runner = () => Promise.reject(new Error('ENOENT'));
    const result = await ask('вопрос', { run });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('failed');
  });
});

/**
 * Настоящий запуск — на подставной программе, которая ведёт себя как
 * `claude -p`: без текста ругается тем же сообщением. Именно здесь и была
 * поломка: текст не доходил до программы, и она отвечала «Input must be
 * provided».
 */
describe('запуск программы', () => {
  const stub = fileURLToPath(new URL('./fixtures/fake-bin/claude.cmd', import.meta.url));

  function withStub<T>(action: () => Promise<T>): Promise<T> {
    const saved = process.env['DOCDD_CLAUDE_PATH'];
    process.env['DOCDD_CLAUDE_PATH'] = stub;
    return action().finally(() => {
      if (saved === undefined) delete process.env['DOCDD_CLAUDE_PATH'];
      else process.env['DOCDD_CLAUDE_PATH'] = saved;
    });
  }

  it.skipIf(process.platform !== 'win32')('текст доходит до программы, а не теряется по дороге', async () => {
    const result = await withStub(() => ask('короткий запрос'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.answer).toContain('короткий запрос');
  }, 30_000);

  it.skipIf(process.platform !== 'win32')('длинный запрос доходит целиком', async () => {
    const long = 'д'.repeat(30_000);
    const result = await withStub(() => ask(long));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.answer.length).toBeGreaterThan(29_000);
  }, 30_000);
});

describe('availability', () => {
  /**
   * Окружение подменяется целиком: иначе на машине, где Claude Code
   * действительно установлен, проверка «не найден» никогда не сработает.
   */
  const VARS = ['DOCDD_CLAUDE_PATH', 'PATH', 'Path', 'APPDATA', 'LOCALAPPDATA', 'USERPROFILE', 'HOME'];

  function inEnvironment<T>(values: Record<string, string>, action: () => T): T {
    const saved = new Map(VARS.map((name) => [name, process.env[name]]));
    try {
      for (const name of VARS) delete process.env[name];
      for (const [name, value] of Object.entries(values)) process.env[name] = value;
      return action();
    } finally {
      for (const [name, value] of saved) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  }

  const empty = fileURLToPath(new URL('./fixtures/example-project/', import.meta.url));

  it('находит Claude Code в PATH: иначе кнопка гаснет у тех, у кого всё в порядке', () => {
    const dir = fileURLToPath(new URL('./fixtures/fake-bin/', import.meta.url));
    const found = inEnvironment({ PATH: dir, APPDATA: empty, LOCALAPPDATA: empty, USERPROFILE: empty }, availability);
    expect(found.available).toBe(true);
    expect(found.command).toContain('claude');
  });

  it('находит установку через winget, даже когда PATH устарел', () => {
    const local = fileURLToPath(new URL('./fixtures/fake-winget/', import.meta.url));
    const found = inEnvironment({ PATH: empty, APPDATA: empty, LOCALAPPDATA: local, USERPROFILE: empty }, availability);
    expect(found.available).toBe(true);
    expect(found.command).toContain('Anthropic.ClaudeCode');
  });

  it('не найден — это состояние с объяснением, а не пустой отказ', () => {
    const found = inEnvironment({ PATH: empty, APPDATA: empty, LOCALAPPDATA: empty, USERPROFILE: empty }, availability);
    expect(found.available).toBe(false);
    expect(found.reason).toContain('DOCDD_CLAUDE_PATH');
  });
});

describe('childEnvironment', () => {
  it('убирает метки сессии и оставляет всё остальное', () => {
    const clean = childEnvironment({
      PATH: '/usr/bin',
      HOME: '/home/user',
      ANTHROPIC_API_KEY: 'ключ пользователя',
      CLAUDECODE: '1',
      CLAUDE_CODE_SESSION_ID: 'abc',
      CLAUDE_PID: '123'
    });

    expect(clean['PATH']).toBe('/usr/bin');
    expect(clean['HOME']).toBe('/home/user');
    // Свой ключ пользователь ставит осознанно — его не трогаем.
    expect(clean['ANTHROPIC_API_KEY']).toBe('ключ пользователя');
    expect(clean['CLAUDECODE']).toBeUndefined();
    expect(clean['CLAUDE_CODE_SESSION_ID']).toBeUndefined();
    expect(clean['CLAUDE_PID']).toBeUndefined();
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

describe('отмена', () => {
  it('снимает запущенную программу, а не только прекращает ожидание', async () => {
    const controller = new AbortController();
    // Программа, которая сама бы не кончилась ещё десять секунд.
    const running = spawnClaude('node', ['-e', 'setTimeout(() => {}, 10000)'], '', {
      timeoutMs: 10_000,
      maxBytes: 1024,
      signal: controller.signal
    });

    const started = Date.now();
    controller.abort();
    await expect(running).rejects.toThrow(/aborted/);
    // Ждали бы — прошло бы десять секунд.
    // Снятие идёт по дереву процессов: под оболочкой Windows программа —
    // внук, и `kill` по одному только потомку оставил бы её работать.
    expect(Date.now() - started).toBeLessThan(3000);
  }, 20_000);

  it('отменённый запрос называется отменённым, а не ошибкой', async () => {
    const controller = new AbortController();
    const run: Runner = () => Promise.reject(new Error('aborted by user'));

    controller.abort();
    const result = await ask('вопрос', { run, signal: controller.signal });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('cancelled');
  });
});

describe('лента работы модели', () => {
  const LINES = [
    JSON.stringify({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Смот' } } }),
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: 'a.ts' } }] } }),
    JSON.stringify({ type: 'result', subtype: 'success', result: 'Готовый ответ.' })
  ].join(String.fromCharCode(10)) + String.fromCharCode(10);

  it('события уходят по ходу работы, а не в конце', async () => {
    const seen: string[] = [];
    const run: Runner = (_command, _args, _input, options) => {
      // Программа пишет вывод кусками — так же, как настоящая.
      options.onData?.(LINES.slice(0, 60));
      options.onData?.(LINES.slice(60));
      return Promise.resolve({ stdout: LINES, stderr: '', code: 0 });
    };

    const result = await ask('вопрос', { run, onEvent: (event) => seen.push(event.kind) });
    expect(seen).toEqual(['text', 'action', 'answer']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Ответ — тот, что назвала сама модель, а не склейка ленты.
    expect(result.answer).toBe('Готовый ответ.');
  });

  it('лента просится только тогда, когда её показывают', async () => {
    const asked: string[][] = [];
    const run: Runner = (_command, args) => {
      asked.push([...args]);
      return Promise.resolve({ stdout: 'обычный ответ', stderr: '', code: 0 });
    };

    await ask('вопрос', { run });
    expect(asked[0]).not.toContain('--output-format');

    await ask('вопрос', { run, onEvent: () => {} });
    expect(asked[1]).toContain('stream-json');
  });

  it('не разобравшаяся лента не оставляет без ответа', async () => {
    // Формат задан не нами и может измениться — ответ всё равно должен дойти.
    const run: Runner = () => Promise.resolve({ stdout: 'ответ не по формату', stderr: '', code: 0 });

    const result = await ask('вопрос', { run, onEvent: () => {} });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.answer).toBe('ответ не по формату');
  });
});
