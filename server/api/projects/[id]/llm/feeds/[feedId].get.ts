import { defineEventHandler, getQuery, getRouterParam } from 'h3';

import { canSee } from '../../../../../lib/job-feed';
import { fail } from '../../../../../utils/http';
import { getFeed, whoIs } from '../../../../../utils/job-feeds';
import { eventStream } from '../../../../../utils/sse';

/**
 * Подключиться к ленте задания заново (ADR-0034): накопленное с `from`, дальше по мере
 * работы, в конце `done` или `error`. Чужую и неизвестную ленту не отличаем — обе 404.
 */
export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id') ?? '';
  const feed = getFeed(getRouterParam(event, 'feedId') ?? '');
  const { user, admin } = whoIs(event);
  if (!feed || !canSee(feed, projectId, user, admin)) return fail(event, 404, 'feed_not_found', 'Такого задания нет или оно уже забыто');

  const from = Math.max(0, Number(getQuery(event)['from']) || 0);
  const wire = eventStream(event);
  await new Promise<void>((resolve) => {
    const stop = feed.subscribe(from, (item) => {
      if (item.name === '__end') { wire.close(); resolve(); return; }
      wire.send(item.name, item.payload);
    });
    // Браузер ушёл снова — отписываемся; задание идёт дальше.
    event.node.res.on('close', () => { stop(); resolve(); });
  });
});
