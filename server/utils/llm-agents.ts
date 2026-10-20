import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { env, platform } from 'node:process';

import { childEnvironment, looksLikeRefusal, spawnClaude, type Access, type AskOptions, type LlmResult } from './llm';

/**
 * Агентные провайдеры помимо Claude Code: Codex CLI и Gemini CLI (ADR-0019).
 * Принимают тот же запрос, что и `ask` из llm.ts, и отдают тот же `LlmResult`,
 * поэтому реестр провайдеров держит их наравне. Ключей не храним: как и в
 * ADR-0008, программа авторизована у пользователя сама.
 *
 * Лента событий у этих CLI другая; пока ход работы не показываем, а ответ
 * берём из вывода целиком.
 */

abstract class CliAgent {
  abstract readonly id: string;
  abstract readonly binary: string;
  /** Переменная с явным путём — как DOCDD_CLAUDE_PATH. */
  abstract readonly pathVariable: string;
  /** Агентные CLI ходят по файлам и запускают команды. */
  readonly tools = true;

  protected abstract args(prompt: string, access: Access): string[];

  command(): string | null {
    const named = env[this.pathVariable];
    if (named && existsSync(named)) return named;
    const extensions = platform === 'win32' ? (env['PATHEXT'] ?? '.COM;.EXE;.BAT;.CMD').split(';').map((e) => e.toLowerCase()) : [''];
    for (const dir of (env['PATH'] ?? env['Path'] ?? '').split(delimiter)) {
      if (!dir) continue;
      for (const extension of extensions) {
        const candidate = join(dir, `${this.binary}${extension}`);
        if (existsSync(candidate)) return candidate;
      }
    }
    return null;
  }

  async ask(prompt: string, options: AskOptions = {}): Promise<LlmResult> {
    const command = this.command();
    if (!command && !options.run) {
      return { ok: false, failure: { code: 'unavailable', message: `${this.binary} не найден. Установите его или назовите путь в ${this.pathVariable}.` } };
    }
    const run = options.run ?? spawnClaude;
    const started = Date.now();
    try {
      // Запрос — аргументом: у этих CLI режим стандартного ввода различается, а аргумент работает у всех.
      const result = await run(command ?? this.binary, this.args(prompt, options.access ?? 'read'), '', {
        timeoutMs: options.timeoutMs ?? 0,
        maxBytes: options.maxBytes ?? 4 * 1024 * 1024,
        env: childEnvironment(),
        ...(options.cwd ? { cwd: options.cwd } : {}),
        ...(options.signal ? { signal: options.signal } : {})
      });
      const answer = result.stdout.trim();
      if (result.code !== 0 && answer === '') {
        return { ok: false, failure: { code: /login|auth|401|403/i.test(result.stderr) ? 'unauthorized' : 'failed', message: `${this.binary} завершился с кодом ${result.code ?? '—'}`, detail: result.stderr.trim().slice(0, 500) } };
      }
      if (answer === '') return { ok: false, failure: { code: 'empty', message: 'Модель вернула пустой ответ' } };
      if (looksLikeRefusal(answer)) return { ok: false, failure: { code: 'unauthorized', message: `${this.binary} отказал в доступе`, detail: answer.slice(0, 500) } };
      return { ok: true, answer, ms: Date.now() - started };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (options.signal?.aborted || /aborted/i.test(message)) return { ok: false, failure: { code: 'cancelled', message: 'Запрос отменён' } };
      return { ok: false, failure: { code: 'failed', message: `Не удалось запустить ${this.binary}`, detail: message } };
    }
  }
}

/** Права соответствуют уровням Access: read/none — только чтение, edits — правки в папке, full — всё. */
export class CodexCliProvider extends CliAgent {
  readonly id = 'codex-cli';
  readonly binary = 'codex';
  readonly pathVariable = 'DOCDD_CODEX_PATH';

  protected args(prompt: string, access: Access): string[] {
    const sandbox = access === 'full' ? 'danger-full-access' : access === 'edits' ? 'workspace-write' : 'read-only';
    return ['exec', '--sandbox', sandbox, prompt];
  }
}

export class GeminiCliProvider extends CliAgent {
  readonly id = 'gemini-cli';
  readonly binary = 'gemini';
  readonly pathVariable = 'DOCDD_GEMINI_PATH';

  protected args(prompt: string, access: Access): string[] {
    // Без подтверждающего режима Gemini CLI не станет править файлы: спросить некого, и это и есть уровень «читать».
    const mode = access === 'full' ? ['--yolo'] : access === 'edits' ? ['--approval-mode', 'auto_edit'] : [];
    return [...mode, '-p', prompt];
  }
}
