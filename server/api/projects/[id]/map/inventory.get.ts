import { defineEventHandler, getRouterParam } from 'h3';

import { WorkspaceError } from '../../../../lib/workspace';
import { fail } from '../../../../utils/http';
import { inventoryOf } from '../../../../utils/inventory-service';
import { findProject } from '../../../../utils/projects';

/**
 * Состояние описи файлов (docs/07-maps.md): сколько описано, сколько ждёт
 * очереди, что изменилось после описания и чего больше нет. Пустой проект
 * отвечает нулём — это состояние, а не ошибка.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  try {
    const state = inventoryOf(project.root);
    return {
      total: state.total,
      described: state.described.length,
      pending: state.pending,
      changed: state.changed,
      gone: state.gone,
      next: state.next,
      portion: state.portion
    };
  } catch (error) {
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'inventory_failed', 'Не удалось собрать опись файлов', String(error));
  }
});
