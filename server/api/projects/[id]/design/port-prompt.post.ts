import { defineEventHandler, getRouterParam, readBody } from 'h3';
import { useStorage } from 'nitropack/runtime';

import { OutsideRootError } from '../../../../lib/paths';
import { WorkspaceError } from '../../../../lib/workspace';
import { PortError, projectPortPrompt } from '../../../../utils/design-catalog-service';
import { fail } from '../../../../utils/http';
import { findProject } from '../../../../utils/projects';

/**
 * Запрос «перенести компонент на стек» по контракту (docs/16-design-system.md,
 * «Storybook как контракт»). Тело `{ component, stack, branch? }`. Приложение
 * собирает текст и отдаёт его: отправлять ли модели — решает человек.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }
  const body = await readBody<{ component?: unknown; stack?: unknown; branch?: unknown }>(event);
  const component = typeof body?.component === 'string' ? body.component : '';
  const stack = typeof body?.stack === 'string' ? body.stack : '';
  if (component === '' || stack === '') return fail(event, 400, 'port_args', 'Нужны `component` и `stack`');
  const branch = typeof body?.branch === 'string' && body.branch.trim() !== '' ? body.branch.trim() : `port/${stack}/${component.toLowerCase()}`;
  // Имя ветки попадает в команды git в тексте запроса: лишние символы там — повод для беды.
  if (!/^[A-Za-z0-9._][A-Za-z0-9._/-]*$/.test(branch) || branch.includes('..')) {
    return fail(event, 400, 'branch_invalid', 'Имя ветки: только латиница, цифры и `._/-`, без `..`');
  }

  try {
    const template = await useStorage('assets:prompts').getItem('design-port.md');
    const text = typeof template === 'string' ? template : template instanceof Uint8Array ? Buffer.from(template).toString('utf8') : null;
    if (text === null) return fail(event, 500, 'template_missing', 'Шаблон запроса `design-port.md` не найден в сборке');
    return { prompt: projectPortPrompt(project.root, text, component, stack, branch) };
  } catch (error) {
    if (error instanceof PortError) return fail(event, 422, error.code, error.message);
    if (error instanceof OutsideRootError) return fail(event, 403, 'outside_root', error.message, error.requested);
    if (error instanceof WorkspaceError) return fail(event, 422, error.code, error.message, error.detail);
    return fail(event, 500, 'design_port_failed', 'Не удалось собрать запрос переноса', String(error));
  }
});
