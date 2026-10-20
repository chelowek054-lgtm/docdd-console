import { defineEventHandler, getRouterParam } from 'h3';

import { readManifest } from '../../../lib/workspace';
import { authEnabled, loadUsers } from '../../../utils/auth';
import { fail } from '../../../utils/http';
import { findProject } from '../../../utils/projects';

/**
 * Команда проекта из манифеста; у каждого — известен ли логин среди учёток
 * сервера. Незнакомый логин не ошибка процесса, а предупреждение: человека
 * могут завести позже. Без включённого входа учёток нет, предупреждать не о чем.
 */
export default defineEventHandler(async (event) => {
  const project = await findProject(decodeURIComponent(getRouterParam(event, 'id') ?? ''));
  if (!project) return fail(event, 404, 'project_not_found', 'Проект не найден');
  const team = readManifest(project.root).team ?? [];
  const logins = authEnabled() ? new Set((await loadUsers()).map((user) => user.login)) : null;
  return team.map((member) => ({ ...member, known: logins ? logins.has(member.login) : true }));
});
