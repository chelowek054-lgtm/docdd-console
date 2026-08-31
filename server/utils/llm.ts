import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { env, platform } from 'node:process';

import { createStreamParser, type ModelEvent } from '../lib/stream-events';

/**
 * Доступ к модели через Claude Code на машине пользователя
 * (docs/adr/0008-llm-through-claude-code.md).
 *
 * Ключей приложение не хранит и в сеть не ходит: оно запускает локальную
 * программу, у которой уже есть авторизация и лимиты. Ответ ничего не меняет
 * сам — он возвращается вызывающему, а решает человек.
 */

export type LlmFailureCode = 'unavailable' | 'unauthorized' | 'timeout' | 'failed' | 'empty' | 'cancelled';

export interface LlmFailure {
  code: LlmFailureCode;
  message: string;
  detail?: string;
}

export type LlmResult =
  | { ok: true; answer: string; ms: number; sessionId?: string }
  | { ok: false; failure: LlmFailure };

/** Где искать Claude Code, если его нет в PATH. */
function candidates(): string[] {
  const home = env['USERPROFILE'] ?? env['HOME'] ?? '';
  const appData = env['APPDATA'] ?? '';
  const local = env['LOCALAPPDATA'] ?? '';
  const windows = platform === 'win32';

  return [
    // Путь можно назвать явно: у разработчика бывает своя сборка.
    env['DOCDD_CLAUDE_PATH'] ?? '',
    windows ? join(appData, 'npm', 'claude.cmd') : '',
    windows ? join(local, 'Programs', 'claude', 'claude.exe') : '',
    join(home, '.claude', 'local', 'claude'),
    join(home, '.local', 'bin', 'claude'),
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
    ...wingetInstalls(local),
    ...versionedInstalls(appData)
  ].filter((path) => path !== '');
}

/**
 * Установка через winget кладёт программу в папку пакета с суффиксом источника.
 * Её каталог попадает в PATH пользователя, но у долго живущего сервера
 * окружение может быть старше установки — тогда искать надо самим.
 */
function wingetInstalls(local: string): string[] {
  const packages = join(local, 'Microsoft', 'WinGet', 'Packages');
  return entries(packages)
    .filter((name) => name.startsWith('Anthropic.ClaudeCode'))
    .map((name) => join(packages, name, 'claude.exe'));
}

/** Установка десктопного приложения: версия в имени папки, берём свежую. */
function versionedInstalls(appData: string): string[] {
  const versions = join(appData, 'Claude', 'claude-code');
  return entries(versions)
    .sort((a, b) => compareVersions(b, a))
    .map((name) => join(versions, name, platform === 'win32' ? 'claude.exe' : 'claude'));
}

function entries(directory: string): string[] {
  try {
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

/** `2.1.247` новее `2.1.246`: сравниваем числами, а не строками. */
function compareVersions(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let at = 0; at < Math.max(left.length, right.length); at += 1) {
    const difference = (left[at] ?? 0) - (right[at] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export interface Availability {
  available: boolean;
  /** Чем именно будем запускать; пусто, когда не нашли. */
  command: string;
  /** Почему недоступно — текст для человека, а не код. */
  reason?: string;
}

/**
 * Есть ли чем спросить. Отсутствие Claude Code — обычное состояние, а не
 * поломка: копирование запроса работает всегда.
 */
export function availability(): Availability {
  for (const path of candidates()) {
    if (existsSync(path)) return { available: true, command: path };
  }
  // Обычная установка кладёт `claude` в PATH, и не найти его там значило бы
  // погасить кнопку у тех, у кого всё в порядке.
  const inPath = lookupPath();
  if (inPath) return { available: true, command: inPath };

  return {
    available: false,
    command: 'claude',
    reason: 'Claude Code не найден. Установите его или назовите путь в переменной окружения DOCDD_CLAUDE_PATH — тогда запрос можно будет отправить кнопкой. Без него текст запроса копируется в буфер.'
  };
}

/**
 * Поиск в PATH. На Windows исполняемость определяется расширением из PATHEXT,
 * на остальных — самим файлом; проверять права не берёмся, ошибка запуска
 * скажет точнее.
 */
function lookupPath(): string | null {
  const dirs = (env['PATH'] ?? env['Path'] ?? '').split(platform === 'win32' ? ';' : ':');
  const extensions = platform === 'win32'
    ? (env['PATHEXT'] ?? '.COM;.EXE;.BAT;.CMD').split(';').map((item) => item.toLowerCase())
    : [''];

  for (const dir of dirs) {
    if (!dir) continue;
    for (const extension of extensions) {
      const candidate = join(dir, `claude${extension}`);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

export interface AskOptions {
  /** Сколько ждать ответа. Зависший процесс не должен вешать сервер. */
  timeoutMs?: number;
  /** Предел размера ответа: карта большого проекта и так велика. */
  maxBytes?: number;
  /**
   * Папка, в которой работает модель. Для карты это корень проекта: иначе она
   * разберёт не тот код и опишет чужое устройство.
   */
  cwd?: string;
  /**
   * Чем запускать. Подменяется в тестах: настоящий вызов стоит денег и времени,
   * а проверять надо разбор ответа и отказы.
   */
  run?: Runner;
  /** Отмена человеком: обрыв запроса браузером доходит сюда. */
  signal?: AbortSignal;
  /**
   * Куда отдавать ход работы. Задан — Claude Code запускается лентой
   * событий; не задан — как раньше, одним ответом.
   */
  onEvent?: (event: ModelEvent) => void;
  /**
   * Продолжить прошлый разговор вместо нового: сто шагов разбора кодовой
   * базы не проходятся заново ради одной правки (docs/09-execution.md).
   */
  resume?: string;
}

export interface RunOptions {
  /** Срок ожидания; `0` или нет поля — без срока: останавливает человек. */
  timeoutMs?: number;
  maxBytes: number;
  cwd?: string;
  /** Окружение потомка: без переменных чужой сессии Claude Code. */
  env?: NodeJS.ProcessEnv;
  /** Отмена человеком: по сигналу запущенная программа снимается. */
  signal?: AbortSignal;
  /** Вывод по мере поступления: лента работы модели идёт на экран сразу. */
  onData?: (chunk: string) => void;
}

/**
 * Переменные, которыми Claude Code метит своих потомков. Унаследовав их,
 * запущенная программа пытается взять доступ у сессии-родителя — и получает
 * `403 Request not allowed`, если та уже закончилась или принадлежит другому.
 * Убираем: пусть авторизуется своей записью, как и задумано ADR-0008.
 */
const SESSION_VARIABLES = /^CLAUDECODE$|^CLAUDE_CODE_|^CLAUDE_PID$|^CLAUDE_EFFORT$|^CLAUDE_AGENT_SDK|^CLAUDE_PREVIEW/i;

export function childEnvironment(source: NodeJS.ProcessEnv = env): NodeJS.ProcessEnv {
  const clean: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(source)) {
    // ANTHROPIC_* не трогаем: их пользователь ставит сам и осознанно.
    if (SESSION_VARIABLES.test(name)) continue;
    clean[name] = value;
  }
  return clean;
}

export type Runner = (
  command: string,
  args: readonly string[],
  input: string,
  options: RunOptions
) => Promise<{ stdout: string; stderr: string; code: number | null }>;

/**
 * Срока у запроса нет: большая задача идёт десятками минут, и таймер, снявший
 * её на полпути, отнимает сделанное, а не защищает (docs/04-ui.md, раздел
 * «Запрос к модели»). Останавливает человек кнопкой.
 */
const NO_TIMEOUT = 0;
const DEFAULT_MAX_BYTES = 4 * 1024 * 1024;

/** Дальше этого запрос в аргумент не влезет: у командной строки Windows свой предел. */
const ARGUMENT_LIMIT = 24_000;

/**
 * Запуск лентой: события приходят строками JSON по мере работы.
 * `--verbose` обязателен — без него Claude Code лентой не отвечает.
 */
/** Так Claude Code говорит, что продолжать нечего. */
const LOST_SESSION = /no conversation found|session .*not found|invalid session/i;

const STREAM_ARGS = ['--output-format', 'stream-json', '--verbose', '--include-partial-messages'];

/**
 * Один запрос. Короткий уходит аргументом — так его получает даже оболочка,
 * которая не передала бы стандартный ввод; длинный (карта большого проекта) —
 * на стандартный ввод, потому что в аргумент он не помещается.
 */
/**
 * Claude Code сообщает об отказе в доступе по-разному: иногда кодом возврата и
 * ошибкой, а иногда печатает строку отказа в обычный вывод и выходит с нулём.
 * Во втором случае отказ приезжал в приложение как ответ модели — поэтому
 * смотрим на сам текст, а не только на код возврата.
 */
const REFUSAL = /Failed to authenticate|API Error: 40[13]|Request not allowed|Invalid API key|OAuth token has expired/i;

/**
 * Отказ — это короткая строка вместо ответа. Длину проверяем, чтобы не принять
 * за отказ разбор задачи, в которой сама по себе речь о 403.
 */
export function looksLikeRefusal(text: string): boolean {
  return text.length <= 400 && REFUSAL.test(text);
}

export async function ask(prompt: string, options: AskOptions = {}): Promise<LlmResult> {
  const found = availability();
  if (!found.available && !options.run) {
    return { ok: false, failure: { code: 'unavailable', message: found.reason ?? 'Claude Code не найден' } };
  }

  const timeoutMs = options.timeoutMs ?? NO_TIMEOUT;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const run = options.run ?? spawnClaude;
  const started = Date.now();

  try {
    // Аргументы фиксированы: от пользователя приходит только текст запроса.
    const inArgument = prompt.length <= ARGUMENT_LIMIT && !needsShell(found.command);
    const args = inArgument ? ['-p', prompt] : ['-p'];
    // Лента событий нужна, только когда её кто-то показывает.
    if (options.onEvent) args.push(...STREAM_ARGS);
    if (options.resume) args.push('--resume', options.resume);

    const parser = createStreamParser();
    let streamed = '';
    let said = '';

    let sessionId = '';

    const collect = (event: ModelEvent) => {
      if (event.kind === 'text') streamed += event.text;
      if (event.kind === 'answer') said = event.text;
      // Номер сессии — не для показа: он нужен следующему заходу.
      if (event.kind === 'session') {
        sessionId = event.text;
        return;
      }
      options.onEvent?.(event);
    };

    const onData = options.onEvent
      ? (chunk: string) => { for (const event of parser.push(chunk)) collect(event); }
      : undefined;

    const result = await run(
      found.command,
      args,
      inArgument ? '' : prompt,
      {
        timeoutMs,
        maxBytes,
        env: childEnvironment(),
        ...(options.cwd ? { cwd: options.cwd } : {}),
        ...(options.signal ? { signal: options.signal } : {}),
        ...(onData ? { onData } : {})
      }
    );

    if (options.onEvent) for (const event of parser.finish()) collect(event);

    // Ответ берём из ленты; не разобралась — из обычного вывода, как раньше.
    // Незнакомый формат ленты не должен оставлять человека без ответа.
    const answer = (said || streamed || result.stdout).trim();

    if (result.code !== 0 && answer === '') {
      const said = `${result.stderr} ${result.stdout}`;

      // Продолжать нечего: сессия не нашлась. Это не беда — начинаем заново,
      // сказав об этом, а не молча теряем запрос.
      if (options.resume && LOST_SESSION.test(said)) {
        options.onEvent?.({ kind: 'action', text: 'прошлый разговор не найден — начинаю заново' });
        const { resume: _lost, ...fresh } = options;
        return ask(prompt, fresh);
      }
      if (looksLikeRefusal(said) || /403|unauthorized/i.test(said)) {
        // Отказ в доступе — не поломка приложения, и путать их нельзя: чинится
        // это в самом Claude Code, а не здесь.
        return {
          ok: false,
          failure: {
            code: 'unauthorized',
            message: 'Claude Code отказал в доступе. Приложение тут ни при чём: проверьте командой `claude -p "привет"` в обычном терминале. Не отвечает и там — обновите его (`winget upgrade Anthropic.ClaudeCode`) и войдите заново.',
            detail: result.stderr.trim().slice(0, 500) || undefined
          }
        };
      }
      return {
        ok: false,
        failure: {
          code: 'failed',
          message: `Claude Code завершился с кодом ${result.code ?? '—'}`,
          detail: result.stderr.trim().slice(0, 500) || undefined
        }
      };
    }
    if (answer === '') {
      return { ok: false, failure: { code: 'empty', message: 'Модель вернула пустой ответ' } };
    }

    // Отказ приехал обычным выводом с нулевым кодом: показать его как ответ
    // модели значило бы соврать о том, что работа сделана.
    if (looksLikeRefusal(answer)) {
      return {
        ok: false,
        failure: {
          code: 'unauthorized',
          message: 'Claude Code отказал в доступе. Приложение тут ни при чём: проверьте командой `claude -p "привет"` в обычном терминале. Не отвечает и там — обновите его (`winget upgrade Anthropic.ClaudeCode`) и войдите заново.',
          detail: answer.slice(0, 500)
        }
      };
    }

    return { ok: true, answer, ms: Date.now() - started, ...(sessionId ? { sessionId } : {}) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Отмена — не поломка: человек передумал ждать, и говорить об ошибке здесь
    // значило бы пугать на ровном месте.
    if (options.signal?.aborted || /aborted|отмен/i.test(message)) {
      return { ok: false, failure: { code: 'cancelled', message: 'Запрос отменён' } };
    }
    if (/timed? ?out|ETIMEDOUT/i.test(message)) {
      return {
        ok: false,
        failure: {
          code: 'timeout',
          message: `Ответа нет дольше ${Math.round(timeoutMs / 1000)} секунд. Запрос отменён.`
        }
      };
    }
    return { ok: false, failure: { code: 'failed', message: 'Не удалось запустить Claude Code', detail: message } };
  }
}

/** Node отказывается запускать `.cmd` и `.bat` напрямую — только через оболочку. */
function needsShell(command: string): boolean {
  return /\.(cmd|bat)$/i.test(command);
}

/**
 * Снять процесс со всем, что он породил. На Windows Claude Code запускается
 * через `claude.cmd`, то есть под оболочкой: `kill` снимает её, а сама
 * программа остаётся работать. Обещание «отменили» тогда было бы враньём —
 * поэтому дерево целиком (docs/04-ui.md, раздел «Запрос к модели»).
 */
function killTree(child: ChildProcess): void {
  if (platform === 'win32' && child.pid) {
    execFile('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true }, () => {
      // Не получилось — процесс уже кончился сам; отдельно сообщать не о чем.
    });
    return;
  }
  child.kill();
}

/** Экспортируется ради теста на отмену: он проверяет, что программа снята. */
export const spawnClaude: Runner = (
  command,
  args,
  input,
  { timeoutMs, maxBytes, cwd, env: childEnv, signal, onData }
) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: needsShell(command),
      windowsHide: true,
      ...(childEnv ? { env: childEnv } : {}),
      ...(cwd ? { cwd } : {})
    });

    let stdout = '';
    let stderr = '';
    let stopped = false;

    // Срок ставится, только если его назначили: без него ждём, пока работает.
    const timer = timeoutMs
      ? setTimeout(() => {
          stopped = true;
          killTree(child);
          reject(new Error(`timed out after ${timeoutMs} ms`));
        }, timeoutMs)
      : undefined;

    // Отмена обязана снимать программу, а не только прекращать ожидание:
    // иначе человек считает, что остановил, а модель продолжает работать.
    const cancel = () => {
      stopped = true;
      clearTimeout(timer);
      killTree(child);
      reject(new Error('aborted by user'));
    };
    if (signal) {
      if (signal.aborted) {
        cancel();
        return;
      }
      signal.addEventListener('abort', cancel, { once: true });
    }

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      // Предел размера: ответ на карту большого проекта и так велик.
      if (stdout.length < maxBytes) stdout += chunk;
      // Наружу отдаём сразу: лента идёт на экран, а не копится до конца.
      onData?.(chunk);
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });

    child.on('error', (error) => {
      clearTimeout(timer);
      if (!stopped) reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      if (!stopped) resolve({ stdout, stderr, code });
    });

    // Ввод закрываем всегда: с открытым и пустым стандартным вводом Claude Code
    // будет ждать текста, которого не будет.
    child.stdin.on('error', () => { /* закрылся раньше нас — ответ уже пишется */ });
    child.stdin.end(input);
  });

/**
 * Ответ модели часто приходит в ограждении из тройных кавычек. Достаём то, что
 * внутри, — или отдаём как есть, если ограждения нет.
 */
export function unfence(answer: string, language?: string): string {
  const pattern = language
    ? new RegExp('```[ \\t]*' + language + '[ \\t]*\\r?\\n([\\s\\S]*?)```', 'm')
    : /```[a-zA-Z-]*[ \t]*\r?\n([\s\S]*?)```/m;
  const match = pattern.exec(answer);
  return (match?.[1] ?? answer).trim();
}
