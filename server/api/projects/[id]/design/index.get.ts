import { defineEventHandler, getRouterParam } from 'h3';

import { OutsideRootError } from '../../../../lib/paths';
import { WorkspaceError } from '../../../../lib/workspace';
import { projectDesign } from '../../../../utils/design-service';
import { fail } from '../../../../utils/http';
import { fingerprintWithSources, memoByFingerprint } from '../../../../utils/memo';
import { findProject } from '../../../../utils/projects';

/**
 * Токены дизайна проекта после сложения «общее → локальное» с источником у
 * каждой части (docs/16-design-system.md). Производное: нигде не хранится.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  try {
    const { tokens, checks, contrast, conflicts, problems, sources, empty, connected, componentsMissing, stacks } =
      memoByFingerprint(
        project.root,
        'design',
        () => fingerprintWithSources(project.root),
        () => projectDesign(project.root)
      );
    return { tokens, checks, contrast, conflicts, problems, sources, empty, connected, componentsMissing, stacks };
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'design_failed', 'Не удалось собрать токены дизайна', String(error));
  }
});
