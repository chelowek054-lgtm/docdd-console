import { defineEventHandler, getQuery } from 'h3';

import { ALL_ACTIONS, can, type TeamMember, type Verdict } from '../../lib/permissions';
import { readManifest } from '../../lib/workspace';
import { authEnabled, currentUser } from '../../utils/auth';
import { findProject } from '../../utils/projects';

/**
 * Экрану нужно знать, включён ли вход, кто вошёл и что ему можно в проекте
 * (`?project=<id>`): кнопка без права неактивна и называет причину.
 * Без входа — `required: false`, права не ограничены.
 */
export default defineEventHandler(async (event) => {
  if (!authEnabled()) return { required: false, user: null, can: null };
  const user = await currentUser(event);
  if (!user) return { required: true, user: null, can: null };

  const projectId = getQuery(event)['project'];
  let team: TeamMember[] | undefined;
  if (typeof projectId === 'string') {
    const project = await findProject(projectId);
    if (project) {
      try {
        team = readManifest(project.root).team;
      } catch {
        team = undefined;
      }
    }
  }
  const verdicts: Record<string, Verdict> = {};
  for (const action of ALL_ACTIONS) verdicts[action] = can(user, team, action);
  return {
    required: true,
    user: { login: user.login, name: user.name, admin: user.admin },
    can: typeof projectId === 'string' ? verdicts : null, roles: team?.find((member) => member.login === user.login)?.roles ?? []
  };
});
