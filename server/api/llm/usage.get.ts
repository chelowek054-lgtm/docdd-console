import { defineEventHandler, getQuery } from 'h3';

import { summarize } from '../../lib/llm-usage';
import { can, type TeamMember } from '../../lib/permissions';
import { readManifest } from '../../lib/workspace';
import { fail } from '../../utils/http';
import { findProject } from '../../utils/projects';
import { readUsage } from '../../utils/llm-usage-store';

/** Сводка расходов за месяц (`?month=YYYY-MM`, по умолчанию текущий) по людям и моделям; `?projectId=` — один проект. Суммы — оценка по символам. */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  // Сводка по людям и ценам: администратору и роли pm/architect (право `team`) проекта из ?projectId=. Без входа — открыто.
  const user = (event.context as { user?: { login: string; admin: boolean } }).user;
  if (user) {
    let team: TeamMember[] | undefined;
    const project = typeof query.projectId === 'string' ? await findProject(query.projectId) : undefined;
    if (project) { try { team = readManifest(project.root).team; } catch { team = undefined; } }
    if (!user.admin && !can(user, team, 'team').allowed) return fail(event, 403, 'forbidden', 'Расходы по людям видят администратор, pm и architect');
  }
  const month = typeof query.month === 'string' && /^\d{4}-\d{2}$/.test(query.month) ? query.month : new Date().toISOString().slice(0, 7);
  const projectId = typeof query.projectId === 'string' && query.projectId !== '' ? query.projectId : undefined;
  return summarize(readUsage(), month, projectId);
});
