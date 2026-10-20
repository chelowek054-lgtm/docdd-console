import { defineEventHandler, getRequestURL, readBody, setResponseStatus } from 'h3';

import { signature } from '../lib/auth';
import { actionFor, can, type TeamMember } from '../lib/permissions';
import { readManifest } from '../lib/workspace';
import { authEnabled, currentUser, loadUsers } from '../utils/auth';
import { findProject } from '../utils/projects';

/**
 * Единая точка входа и прав (docs/adr/0020-people-roles-permissions.md): каждый
 * запрос к /api проходит здесь до маршрута, поэтому новый пишущий маршрут не
 * может забыть спросить право. Без `DOCDD_AUTH=on` ничего не меняется.
 */
export default defineEventHandler(async (event) => {
  if (!authEnabled()) return;
  const path = getRequestURL(event).pathname;
  if (!path.startsWith('/api/')) return;
  if (path === '/api/auth/login' || path === '/api/auth/me' || path === '/api/auth/logout' || /^\/api\/projects\/[^/]+\/inbox\/alert$/.test(path)) return; // вебхук алертов сам проверяет DOCDD_ALERT_TOKEN

  const deny = (status: number, code: string, message: string) => {
    setResponseStatus(event, status);
    return { error: { code, message } };
  };

  const user = await currentUser(event);
  // Пока ни одной учётки нет, первого администратора заводят без сессии.
  if (!user && path === '/api/auth/users' && event.method === 'POST' && (await loadUsers()).length === 0) return;
  if (!user) return deny(401, 'unauthorized', 'Нужно войти');

  const isUsers = path.startsWith('/api/auth/users');
  const action = isUsers ? 'admin' : actionFor(event.method, path);

  let team: TeamMember[] | undefined;
  const projectId = /^\/api\/projects\/([^/]+)\//.exec(path)?.[1];
  if (projectId) {
    const project = await findProject(decodeURIComponent(projectId));
    if (project) {
      try {
        team = readManifest(project.root).team;
      } catch {
        team = undefined;
      }
    }
  }

  // Список проектов и общие чтения доступны любому вошедшему; содержание проекта — только команде.
  const verdict = isUsers || action === 'admin'
    ? can(user, team, 'admin')
    : projectId ? can(user, team, action) : { allowed: action === 'read' };
  if (!verdict.allowed) return deny(403, 'forbidden', ('reason' in verdict && verdict.reason) || 'Нет права на это действие');

  const roles = team?.find((member) => member.login === user.login)?.roles ?? [];
  event.context['user'] = { login: user.login, name: user.name, admin: user.admin, roles };

  // Подпись — вошедшим человеком, а не выбором из списка: тело правим до маршрута.
  if (['POST', 'PATCH', 'PUT'].includes(event.method) && !isUsers) {
    const body = await readBody<Record<string, unknown>>(event).catch(() => null);
    if (body && typeof body === 'object') body['actor'] = signature(user.name, roles);
  }
});
