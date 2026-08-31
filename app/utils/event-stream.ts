/**
 * Чтение ленты событий сервера (docs/03-server-api.md) и складывание её в
 * строки для экрана. Здесь только разбор — ни запросов, ни состояния.
 */

export interface StreamLine {
  kind: 'text' | 'action' | 'result';
  text: string;
  failed?: boolean;
}

const NEW_LINE = String.fromCharCode(10);

/**
 * Текст модели идёт кусками по несколько букв: каждая — не строка ленты, иначе
 * ответ рассыплется на сотню обрывков. Куски текста склеиваются в одну строку,
 * пока их не прервёт обращение к файлу или команде.
 */
export function add(lines: StreamLine[], name: string, payload: StreamLine): void {
  if (name !== 'text' && name !== 'action' && name !== 'result') return;
  const text = typeof payload?.text === 'string' ? payload.text : '';
  if (text === '') return;

  const last = lines[lines.length - 1];
  if (name === 'text' && last?.kind === 'text') {
    last.text += text;
    return;
  }
  lines.push(name === 'result' ? { kind: name, text, failed: payload.failed === true } : { kind: name, text });
}

/**
 * Разбор потока в события. Кусок рвётся посередине записи, поэтому хвост
 * держится до следующего куска — так же, как на сервере.
 */
export async function readEvents(
  body: ReadableStream<Uint8Array>,
  onEvent: (name: string, payload: unknown) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let tail = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    tail += decoder.decode(value, { stream: true });

    let split = tail.indexOf(NEW_LINE + NEW_LINE);
    while (split !== -1) {
      emit(tail.slice(0, split), onEvent);
      tail = tail.slice(split + 2);
      split = tail.indexOf(NEW_LINE + NEW_LINE);
    }
  }
}

function emit(block: string, onEvent: (name: string, payload: unknown) => void): void {
  let name = 'message';
  let data = '';
  for (const line of block.split(NEW_LINE)) {
    if (line.startsWith('event: ')) name = line.slice(7).trim();
    if (line.startsWith('data: ')) data += line.slice(6);
  }
  if (data === '') return;
  try {
    onEvent(name, JSON.parse(data));
  } catch {
    // Оборвавшуюся запись показывать нечем.
  }
}
