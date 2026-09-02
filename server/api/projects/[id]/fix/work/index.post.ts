import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { normalizeRoot } from '../../../../../lib/paths';
import { acceptFix, borderOf, borderOfChosen, rejectFix } from '../../../../../utils/fix-service';
import { pickedIssues } from '../../../../../utils/chosen';
import { fail } from '../../../../../utils/http';
import { loadIndex } from '../../../../../utils/index-service';
import { findProject } from '../../../../../utils/projects';

/**
 * Три ответа на дифф починки: принять и слить, отклонить. Доработка — это
 * новый план: чинится не задача, а нарушения, и план у неё каждый раз свой
 * (docs/adr/0010-model-fixes-violations.md).
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const body = await readBody<{
    action?: unknown;
    actor?: unknown;
    codes?: unknown;
    severity?: unknown;
    issues?: unknown;
  }>(event);
  const action = typeof body?.action === 'string' ? body.action : '';
  const actor = typeof body?.actor === 'string' ? body.actor : '';
  const codes = Array.isArray(body?.codes) ? body.codes.filter((code): code is string => typeof code === 'string') : [];
  const severity = typeof body?.severity === 'string' ? body.severity : '';

  const root = normalizeRoot(project.root);
  // Граница считается заново из индекса: браузер называет выбор, а не файлы.
  const index = loadIndex(root);
  const chosen = pickedIssues(body?.issues);
  const border = chosen.length ? borderOfChosen(index, chosen) : borderOf(index, codes, severity);
  const allowed = [...border.keys()];

  if (action === 'accept') {
    const outcome = await acceptFix(root, { allowed, codes: border, actor });
    return outcome.ok ? outcome : fail(event, statusFor(outcome.code), outcome.code, outcome.message, outcome.detail);
  }

  if (action === 'reject') {
    return rejectFix(root, allowed);
  }

  return fail(event, 400, 'unknown_action', `Действие \`${action}\` не из списка: accept, reject`);
});

function statusFor(code: string): number {
  if (code === 'not_a_repository' || code === 'detached_head') return 422;
  return 409;
}
