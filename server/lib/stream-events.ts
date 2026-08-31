/**
 * Разбор ленты Claude Code (`--output-format stream-json`) в события, которые
 * показывает экран (docs/04-ui.md, раздел «Что модель делает прямо сейчас»).
 *
 * Чистые функции над строками: ни процессов, ни файлов. Формат ленты задан не
 * нами и может измениться, поэтому разбор устойчив к незнакомому — неизвестное
 * пропускается, а не роняет запрос.
 */

export type ModelEvent =
  | { kind: 'text'; text: string }
  | { kind: 'action'; text: string }
  | { kind: 'result'; text: string; failed: boolean }
  | { kind: 'answer'; text: string }
  /** Номер сессии модели: не для показа, а чтобы продолжить работу. */
  | { kind: 'session'; text: string };

const NEW_LINE = String.fromCharCode(10);
const CARRIAGE_RETURN = String.fromCharCode(13);

/** Длиннее этого на экране не нужно: лента показывает, что происходит, а не всё. */
const LINE_LIMIT = 200;

/** Первая непустая строка — по ней и видно, чем кончилось обращение. */
function firstLine(text: string): string {
  const line = text
    .split(NEW_LINE)
    .map((item) => item.replace(CARRIAGE_RETURN, '').trim())
    .find((item) => item !== '');
  return (line ?? '').slice(0, LINE_LIMIT);
}

/**
 * Как назвать обращение модели. Имя средства — как есть, а вот к чему оно
 * обращается, у каждого своё поле: человеку нужен путь или команда, а не JSON.
 */
function target(input: Record<string, unknown>): string {
  const named = ['file_path', 'path', 'command', 'pattern', 'query', 'url', 'prompt'];
  for (const key of named) {
    const value = input[key];
    if (typeof value === 'string' && value.trim() !== '') return firstLine(value);
  }
  return '';
}

function say(tool: string, input: Record<string, unknown>): string {
  const what = target(input);
  return what ? `${tool}: ${what}` : tool;
}

/**
 * Чем кончилось обращение. Первая строка ответа средства ничего не говорит
 * («1 package com.example»), а счёт говорит: столько прочитано, столько найдено
 * (docs/04-ui.md, раздел «Что модель делает прямо сейчас»).
 */
export function outcomeOf(tool: string, text: string, failed: boolean): string {
  const trimmed = text.trim();
  if (failed) return firstLine(trimmed) || 'не вышло';
  if (trimmed === '') return 'готово';

  // Средства сами говорят, что ничего не нашли, — считать тут нечего.
  if (/^(no files found|no matches found|no content)/i.test(trimmed)) return 'ничего не найдено';

  const count = trimmed.split(NEW_LINE).filter((line) => line.trim() !== '').length;

  if (tool === 'Read' || tool === 'NotebookRead') return `прочитано ${plural(count, 'строка', 'строки', 'строк')}`;
  if (tool === 'Glob') return `найдено ${plural(count, 'файл', 'файла', 'файлов')}`;
  if (tool === 'Grep') return `найдено ${plural(count, 'совпадение', 'совпадения', 'совпадений')}`;
  if (tool === 'Edit' || tool === 'Write' || tool === 'NotebookEdit') return 'записано';

  // Команде счёт строк ничего не объясняет — там важно, что она сказала.
  return firstLine(trimmed) || 'готово';
}

/** Русский счёт: «1 строка», «2 строки», «5 строк». */
function plural(count: number, one: string, few: string, many: string): string {
  const tens = count % 100;
  const ones = count % 10;
  if (tens >= 11 && tens <= 14) return `${count} ${many}`;
  if (ones === 1) return `${count} ${one}`;
  if (ones >= 2 && ones <= 4) return `${count} ${few}`;
  return `${count} ${many}`;
}

interface Block {
  type?: string;
  id?: string;
  tool_use_id?: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: unknown;
  is_error?: boolean;
}

function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item === 'object' && item && 'text' in item ? String((item as Block).text ?? '') : ''))
      .join(' ');
  }
  return '';
}

/**
 * Разбор одной строки ленты. Возвращает пустой список, если строка не о том:
 * незнакомое событие — не ошибка, а просто не наше дело.
 */
export interface ParseState {
  sawDelta: boolean;
  /** Каким средством было обращение: ответ приходит отдельно и лишь с его номером. */
  tools: Map<string, string>;
}

export function parseLine(line: string, state: ParseState): ModelEvent[] {
  const trimmed = line.trim();
  if (trimmed === '' || !trimmed.startsWith('{')) return [];

  let record: Record<string, unknown>;
  try {
    record = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    // Строка оборвалась или это не JSON — показывать нечего.
    return [];
  }

  const type = record['type'];

  // Ответ по кускам, как он пишется.
  if (type === 'stream_event') {
    const event = record['event'] as { type?: string; delta?: { type?: string; text?: string } } | undefined;
    const delta = event?.delta;
    if (event?.type === 'content_block_delta' && delta?.type === 'text_delta' && delta.text) {
      state.sawDelta = true;
      return [{ kind: 'text', text: delta.text }];
    }
    return [];
  }

  if (type === 'assistant') {
    const message = record['message'] as { content?: Block[] } | undefined;
    const events: ModelEvent[] = [];
    for (const block of message?.content ?? []) {
      if (block.type === 'tool_use' && block.name) {
        if (block.id) state.tools.set(block.id, block.name);
        events.push({ kind: 'action', text: say(block.name, block.input ?? {}) });
      }
      // Целый текст берём только тогда, когда кусками он не пришёл: иначе
      // ответ на экране удвоится.
      if (block.type === 'text' && block.text && !state.sawDelta) {
        events.push({ kind: 'text', text: block.text });
      }
    }
    return events;
  }

  if (type === 'user') {
    const message = record['message'] as { content?: Block[] } | undefined;
    const events: ModelEvent[] = [];
    for (const block of message?.content ?? []) {
      if (block.type !== 'tool_result') continue;
      const tool = state.tools.get(block.tool_use_id ?? '') ?? '';
      const failed = block.is_error === true;
      events.push({ kind: 'result', text: outcomeOf(tool, textOf(block.content), failed), failed });
    }
    return events;
  }

  // Номер сессии: по нему следующий заход продолжает этот разговор.
  if (type === 'system' && record['subtype'] === 'init') {
    const id = record['session_id'];
    if (typeof id === 'string' && id !== '') return [{ kind: 'session', text: id }];
  }

  if (type === 'result') {
    const answer = record['result'];
    if (typeof answer === 'string' && answer.trim() !== '') {
      return [{ kind: 'answer', text: answer }];
    }
  }

  return [];
}

/**
 * Лента приходит кусками, и кусок рвётся посередине строки. Держим хвост до
 * следующего куска: разобранная наполовину строка — это не событие.
 */
export function createStreamParser() {
  let tail = '';
  const state: ParseState = { sawDelta: false, tools: new Map() };

  return {
    push(chunk: string): ModelEvent[] {
      const events: ModelEvent[] = [];
      const parts = (tail + chunk).split(NEW_LINE);
      tail = parts.pop() ?? '';
      for (const line of parts) events.push(...parseLine(line, state));
      return events;
    },
    finish(): ModelEvent[] {
      const events = parseLine(tail, state);
      tail = '';
      return events;
    }
  };
}
