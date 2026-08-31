import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { env, platform } from 'node:process';

/**
 * Доступ к модели через Claude Code на машине пользователя
 * (docs/adr/0008-llm-through-claude-code.md).
 *
 * Ключей приложение не хранит и в сеть не ходит: оно запускает локальную
 * программу, у которой уже есть авторизация и лимиты. Ответ ничего не меняет
 * сам — он возвращается вызывающему, а решает человек.
 */

export type LlmFailureCode = 'unavailable' | 'timeout' | 'failed' | 'empty';

export interface LlmFailure {
  code: LlmFailureCode;
  message: string;
  detail?: string;
}

export type LlmResult =
  | { ok: true; answer: string; ms: number }
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
    '/opt/homebrew/bin/claude'
  ].filter((path) => path !== '');
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
   * Чем запускать. Подменяется в тестах: настоящий вызов стоит денег и времени,
   * а проверять надо разбор ответа и отказы.
   */
  run?: Runner;
}

export type Runner = (
  command: string,
  args: readonly string[],
  input: string,
  timeoutMs: number,
  maxBytes: number
) => Promise<{ stdout: string; stderr: string; code: number | null }>;

const DEFAULT_TIMEOUT = 180_000;
const DEFAULT_MAX_BYTES = 4 * 1024 * 1024;

/**
 * Один запрос. Текст уходит на стандартный ввод, а не в аргументы: у аргументов
 * есть предел длины, а запрос с картой проекта его перешагнёт.
 */
export async function ask(prompt: string, options: AskOptions = {}): Promise<LlmResult> {
  const found = availability();
  if (!found.available && !options.run) {
    return { ok: false, failure: { code: 'unavailable', message: found.reason ?? 'Claude Code не найден' } };
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const run = options.run ?? spawnClaude;
  const started = Date.now();

  try {
    // Аргументы фиксированы: от пользователя приходит только текст запроса.
    const result = await run(found.command, ['-p'], prompt, timeoutMs, maxBytes);
    const answer = result.stdout.trim();

    if (result.code !== 0 && answer === '') {
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

    return { ok: true, answer, ms: Date.now() - started };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
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

const spawnClaude: Runner = (command, args, input, timeoutMs, maxBytes) =>
  new Promise((resolve, reject) => {
    const child = execFile(
      command,
      [...args],
      { timeout: timeoutMs, maxBuffer: maxBytes, encoding: 'utf8', windowsHide: true },
      (error, stdout, stderr) => {
        if (error && !stdout) {
          reject(error);
          return;
        }
        resolve({ stdout: stdout ?? '', stderr: stderr ?? '', code: error ? (error.code ?? 1) as number : 0 });
      }
    );
    child.stdin?.end(input);
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
