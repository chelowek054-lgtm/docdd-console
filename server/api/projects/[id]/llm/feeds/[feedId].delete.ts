import { defineEventHandler, getRouterParam } from 'h3';

import { canSee } from '../../../../../lib/job-feed';
import { fail } from '../../../../../utils/http';
import { getFeed, whoIs } from '../../../../../utils/job-feeds';

/** «Отменить» (ADR-0034): единственный путь снять задание — закрытие соединения его не снимает. */
export default defineEventHandler((event) => {
  const projectId = getRouterParam(event, 'id') ?? '';
  const feed = getFeed(getRouterParam(event, 'feedId') ?? '');
  const { user, admin } = whoIs(event);
  if (!feed || !canSee(feed, projectId, user, admin)) return fail(event, 404, 'feed_not_found', 'Такого задания нет или оно уже забыто');
  feed.cancel();
  return { ok: true };
});
