import type { H3Event } from 'h3';

/**
 * Человек нажал «Отменить» — браузер обрывает запрос. Превращаем этот обрыв в
 * сигнал, по которому снимается запущенная программа: отмена, оставляющая
 * процесс работать, обманывает (docs/04-ui.md, раздел «Запрос к модели»).
 *
 * Слушаем ответ, а не запрос: тело к этому месту уже прочитано, и `req` своё
 * `close` отдал ещё тогда — новый слушатель на нём не сработает никогда.
 * Ответ же закрывается ровно в тот момент, когда обрывается связь.
 */
export function abortSignalOf(event: H3Event): AbortSignal {
  const controller = new AbortController();
  const response = event.node.res;

  response.on('close', () => {
    // Ответ дописан — значит запрос кончился сам, а не оборвался.
    if (!response.writableEnded) controller.abort();
  });

  return controller.signal;
}
