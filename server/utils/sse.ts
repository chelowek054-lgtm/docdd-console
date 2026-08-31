import { setResponseHeader, type H3Event } from 'h3';

/**
 * Лента событий для экрана (docs/03-server-api.md). Модель работает минутами, и
 * ответ одним куском в конце оставляет человека наедине с кружком — поэтому
 * события уходят по мере того, как случаются.
 */

const NEW_LINE = String.fromCharCode(10);

export interface EventStream {
  send(name: string, payload: unknown): void;
  close(): void;
  /** Ушло ли уже хоть что-то: после первого события код ответа не переписать. */
  readonly started: boolean;
}

export function eventStream(event: H3Event): EventStream {
  const response = event.node.res;
  let started = false;

  setResponseHeader(event, 'Content-Type', 'text/event-stream; charset=utf-8');
  setResponseHeader(event, 'Cache-Control', 'no-cache, no-transform');
  setResponseHeader(event, 'Connection', 'keep-alive');
  // Иначе посредник копит ленту и отдаёт её разом — то есть ленты нет.
  setResponseHeader(event, 'X-Accel-Buffering', 'no');

  return {
    get started() {
      return started;
    },
    send(name, payload) {
      if (response.writableEnded) return;
      started = true;
      response.write(`event: ${name}${NEW_LINE}data: ${JSON.stringify(payload)}${NEW_LINE}${NEW_LINE}`);
    },
    close() {
      if (!response.writableEnded) response.end();
    }
  };
}
