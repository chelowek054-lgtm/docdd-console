import { defineEventHandler, getRouterParam } from 'h3';

import { OutsideRootError } from '../../../lib/paths';
import { WorkspaceError } from '../../../lib/workspace';
import { fail } from '../../../utils/http';
import { findProject } from '../../../utils/projects';
import { resolveProjectRules } from '../../../utils/rules-service';

/**
 * Действующие правила архитектуры после сложения «минимум → общие → локальные»
 * (docs/12-practice-rules.md). Производное: нигде не хранится.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  try {
    const { rules, sources, conflicts, problems, manifest } = resolveProjectRules(project.root);
    return { rules, sources, conflicts, problems, manifest };
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'rules_failed', 'Не удалось собрать правила', String(error));
  }
});
