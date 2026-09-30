import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { asProposals, planPhases, type PlannedPhase } from '../../../../lib/phase-plan';
import { normalizeRoot, OutsideRootError } from '../../../../lib/paths';
import { WorkspaceError } from '../../../../lib/workspace';
import { fail } from '../../../../utils/http';
import { createRecords } from '../../../../utils/inbox-service';
import { loadIndex } from '../../../../utils/index-service';
import { findProject } from '../../../../utils/projects';

/**
 * Завести фазы по списку, который человек оставил (docs/03-server-api.md).
 * Список правил человек, поэтому проверяется заново. Файлы задач не трогаются:
 * состав задаёт `covers` у новой фазы.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const body = await readBody<{ phases?: unknown }>(event);
  const list = Array.isArray(body?.phases) ? (body.phases as Partial<PlannedPhase>[]) : [];
  const broken = list.filter((phase) => !phase
    || typeof phase.key !== 'string' || phase.key === ''
    || typeof phase.title !== 'string' || phase.title.trim() === ''
    || !Array.isArray(phase.covers) || !phase.covers.every((item) => typeof item === 'string'));
  if (broken.length > 0) {
    return fail(event, 400, 'phases_broken', 'В списке есть фазы без ключа, названия или состава');
  }

  try {
    const root = normalizeRoot(project.root);
    const plan = planPhases(asProposals(list as PlannedPhase[]), loadIndex(root).records);
    if (plan.phases.length === 0) {
      return fail(event, 409, 'nothing_to_create', 'Заводить нечего: ни у одной фазы не осталось задач', plan.problems.join(' '));
    }

    const outcome = createRecords(root, asProposals(plan.phases), []);
    if (!outcome.ok) return fail(event, 409, outcome.code, outcome.message);
    return { created: outcome.created, problems: [...plan.problems, ...outcome.problems] };
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'phases_failed', 'Не удалось завести фазы', String(error));
  }
});
