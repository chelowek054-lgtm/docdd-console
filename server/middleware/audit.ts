import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { defineEventHandler, getRequestURL, readBody } from 'h3';

/** Файл журнала доступа (T-0018): рядом с прочими данными сервера, не в проекте. */
export const AUDIT_FILE = resolve(process.cwd(), '.data', 'audit.jsonl');

/**
 * Строка на каждое пишущее действие: кто, когда, что, над каким проектом.
 * Пишется по завершении ответа, чтобы в строке был исход (код ответа).
 * Имя берётся из входа (`event.context.user`, его даёт слой команды); без входа —
 * из `actor` тела запроса, иначе `local`.
 */
export default defineEventHandler(async (event) => {
  const method = event.method;
  const url = getRequestURL(event);
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS' || !url.pathname.startsWith('/api/')) return;

  let actor = '';
  const user = (event.context as { user?: { name?: unknown; id?: unknown } }).user;
  if (user && typeof user.name === 'string') actor = user.name;
  else if (user && typeof user.id === 'string') actor = user.id;
  else {
    try {
      const body = await readBody<{ actor?: unknown }>(event);
      if (typeof body?.actor === 'string') actor = body.actor;
    } catch {
      // Тело не JSON — имя неизвестно, это не повод отказать запросу.
    }
  }

  const projectMatch = /^\/api\/projects\/([^/]+)/.exec(url.pathname);
  const startedAt = new Date().toISOString();
  event.node.res.on('finish', () => {
    try {
      mkdirSync(dirname(AUDIT_FILE), { recursive: true });
      const line = {
        at: startedAt,
        actor: actor || 'local',
        method,
        path: url.pathname,
        project: projectMatch ? decodeURIComponent(projectMatch[1] ?? '') : null,
        status: event.node.res.statusCode
      };
      appendFileSync(AUDIT_FILE, JSON.stringify(line) + '\n', 'utf8');
    } catch {
      // Журнал не должен ронять само действие.
    }
  });
});
