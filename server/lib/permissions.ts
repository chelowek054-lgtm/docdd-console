/**
 * Матрица «роль → действие» (docs/adr/0020-people-roles-permissions.md, п. 4).
 * Чистые функции: проверяются без сервера. Манифест может права только сузить.
 */
import { AGENT_FORBIDDEN_ACTIONS } from './agents';

export type Action =
  | 'read'
  | 'edit_draft'
  | 'approve'
  | 'work'
  | 'model'
  | 'merge'
  | 'reorder'
  | 'team'
  | 'admin';

export const ALL_ACTIONS: readonly Action[] = [
  'read', 'edit_draft', 'approve', 'work', 'model', 'merge', 'reorder', 'team', 'admin'
];

const WRITE: readonly Action[] = ALL_ACTIONS.filter((action) => action !== 'read' && action !== 'admin');

/** Роль без записи в матрице не получает ничего пишущего: расширяемый список ролей безопасен по умолчанию. */
export const ROLE_ACTIONS: Readonly<Record<string, readonly Action[]>> = {
  architect: ['read', ...WRITE],
  developer: ['read', 'edit_draft', 'work', 'model', 'merge'],
  pm: ['read', 'edit_draft', 'reorder', 'team'],
  analyst: ['read', 'edit_draft', 'approve', 'model'],
  domain: ['read', 'edit_draft'],
  viewer: ['read'], designer: ['read', 'edit_draft', 'approve', 'model'], qa: ['read', 'edit_draft', 'approve', 'work', 'model'], devops: ['read', 'edit_draft', 'work', 'model', 'merge'], support: ['read', 'edit_draft']
};

export interface TeamMember {
  login: string;
  roles: string[];
  /** Сужение: действия, которые манифест у этого человека отнимает. */
  deny?: string[];
}

export interface Verdict {
  allowed: boolean;
  reason?: string;
}

/** Право человека на действие в проекте с такой командой. Администратор сервера — не роль проекта. */
export function can(
  user: { login: string; admin: boolean; agent?: unknown } | null,
  team: readonly TeamMember[] | undefined,
  action: Action
): Verdict {
  if (!user) return { allowed: false, reason: 'Нужно войти' };
  // Агенту при любой роли не сливать и не управлять командой (ADR-0033).
  if (user.agent && AGENT_FORBIDDEN_ACTIONS.has(action)) return { allowed: false, reason: `Агенту действие «${action}» недоступно: это делает человек` };
  if (action === 'admin') {
    return user.admin ? { allowed: true } : { allowed: false, reason: 'Только администратор сервера' };
  }
  const member = team?.find((item) => item.login === user.login);
  if (!member) return { allowed: false, reason: 'Вы не входите в команду проекта' };
  if (member.deny?.includes(action)) return { allowed: false, reason: 'Манифест проекта отнимает это право' };
  const granted = member.roles.some((role) => ROLE_ACTIONS[role]?.includes(action));
  return granted
    ? { allowed: true }
    : { allowed: false, reason: `Роль ${member.roles.join(', ') || '—'} не даёт права «${action}»` };
}

/**
 * Какое право нужно маршруту. Таблица одна на все пишущие маршруты: маршрут без
 * особой записи требует `edit_draft`, а не пропускается.
 */
export function actionFor(method: string, path: string, body?: unknown): Action {
  const verb = method.toUpperCase();
  if (verb === 'GET' || verb === 'HEAD' || verb === 'OPTIONS') return 'read';
  // Предпросмотр ничего не пишет.
  if (/\/preview\/?$/.test(path) || /\/progress-question\/?$/.test(path)) return 'read';
  if (/^\/api\/projects\/?$/.test(path) || /^\/api\/projects\/init\/?$/.test(path) || /^\/api\/projects\/[^/]+\/?$/.test(path)) {
    return 'admin';
  }
  if (/^\/api\/notifications\/channel\/?$/.test(path)) return 'admin';
  if (/\/shared\/?$/.test(path)) return 'team';
  // Агенты определяют, что делает модель от имени роли: это управление командой (ADR-0033).
  if (/\/agents(\/|$)/.test(path)) return 'team';
  // Слияние (accept) — отдельное право `merge`: его можно отнять манифестом, не отнимая работу.
  if (/\/records\/[^/]+\/work\/?$/.test(path) && (body as { action?: unknown } | null | undefined)?.action === 'accept') return 'merge';
  if (/\/work\/?$/.test(path) || /\/fix(\/work)?\/?$/.test(path)) return 'work';
  if (/^\/api\/llm\//.test(path) || /\/prompt\/?$/.test(path)) return 'model';
  if (/\/(status|verified)\/?$/.test(path) || /\/bulk\/(status|legacy)\/?$/.test(path)) return 'approve';
  if (/\/priority\/apply\/?$/.test(path) || /\/phases\/?$/.test(path)) return 'reorder';
  return 'edit_draft';
}

/**
 * Пишущие маршруты по именам файлов в server/api: `a/[id]/b.post.ts` →
 * `POST /api/a/:id/b`. Чистая функция над строками, чтобы тест-обход
 * (tests/permissions-routes.spec.ts) не зависел от файловой системы сервера.
 */
export function writeRoutes(files: readonly string[]): { method: string; path: string }[] {
  const routes: { method: string; path: string }[] = [];
  for (const file of files) {
    const match = /^(.*?)(?:\.(post|put|patch|delete))\.ts$/.exec(file.split(String.fromCharCode(92)).join('/'));
    if (!match?.[1] || !match[2]) continue;
    const parts = match[1].split('/').filter((part) => part !== 'index').map((part) => (/^\[.+\]$/.test(part) ? 'x' : part));
    routes.push({ method: match[2].toUpperCase(), path: `/api/${parts.join('/')}` });
  }
  return routes;
}
