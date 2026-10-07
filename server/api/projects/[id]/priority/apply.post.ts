import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { OutsideRootError } from '../../../../lib/paths';
import type { PriorityPlan } from '../../../../lib/work-order';
import { WorkspaceError } from '../../../../lib/workspace';
import { fail } from '../../../../utils/http';
import { findProject } from '../../../../utils/projects';
import { applyPriority } from '../../../../utils/priority-service';

/**
 * «Применить порядок» (docs/04-ui.md, «Порядок по важности»): записывает то, что человек
 * подтвердил, — `rank` у фаз и порядок `covers`. Модель и приложение сами порядок не
 * записывают.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const body = await readBody<{ phases?: unknown; actor?: unknown }>(event);
  if (!Array.isArray(body?.phases) || body.phases.length === 0) {
    return fail(event, 400, 'phases_required', 'Нечего записывать: порядок пуст');
  }
  const phases = (body.phases as { id?: unknown; why?: unknown; tasks?: unknown }[]).map((phase) => ({
    id: typeof phase?.id === 'string' ? phase.id : '',
    why: typeof phase?.why === 'string' ? phase.why : '',
    tasks: (Array.isArray(phase?.tasks) ? phase.tasks : []).map((task: unknown) => {
      const value = typeof task === 'string' ? { id: task, why: '' } : (task as { id?: unknown; why?: unknown });
      return { id: typeof value?.id === 'string' ? value.id : '', why: typeof value?.why === 'string' ? value.why : '' };
    })
  }));
  const plan: PriorityPlan = { phases };
  const actor = typeof body?.actor === 'string' && body.actor ? body.actor : 'приложение';

  try {
    const outcome = applyPriority(project.root, plan, actor);
    return outcome.ok ? outcome : fail(event, 422, outcome.code, outcome.message);
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'priority_failed', 'Не удалось записать порядок', String(error));
  }
});
