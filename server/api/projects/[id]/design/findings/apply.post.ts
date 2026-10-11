import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { dropCache } from '../../../../../lib/cache';
import { parseFindings, type ScreenFinding, type ScreenPass } from '../../../../../lib/design-screens';
import { OutsideRootError } from '../../../../../lib/paths';
import { WorkspaceError } from '../../../../../lib/workspace';
import { projectScreens, writeDesignReport } from '../../../../../utils/design-screens-service';
import { fail } from '../../../../../utils/http';
import { findProject } from '../../../../../utils/projects';

/**
 * «Принять» находки (docs/16-design-system.md): записывает отчёт прохода в
 * каталог отчётов проекта. Принимает то, что человек оставил на экране, и
 * заново проверяет его по описи: сервер не верит телу запроса вслепую.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const body = await readBody<{ pass?: unknown; findings?: unknown; clean?: unknown; actor?: unknown }>(event);
  const pass = body?.pass;
  if (pass !== 'responsive' && pass !== 'pixel') {
    return fail(event, 400, 'pass_invalid', 'Проход — `responsive` или `pixel`');
  }
  const actor = typeof body?.actor === 'string' && body.actor ? body.actor : 'приложение';

  try {
    // Тело приходит в том же виде, что у ответа модели, и проходит тот же разбор.
    const block = JSON.stringify({ pass, findings: body?.findings ?? [], clean: body?.clean ?? [] });
    const checked = parseFindings(`\`\`\`docdd-design-findings\n${block}\n\`\`\``, projectScreens(project.root));
    if (checked.problems.length > 0) {
      return fail(event, 422, 'findings_invalid', 'Часть находок не относится к экранам проекта: перечитайте и разберите ответ заново', checked.problems.join(' '));
    }

    const report = writeDesignReport(project.root, {
      pass: pass as ScreenPass,
      findings: checked.findings as ScreenFinding[],
      clean: checked.clean,
      actor
    });
    dropCache(project.root);
    return { ok: true, report, findings: checked.findings.length };
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'design_apply_failed', 'Не удалось записать отчёт', String(error));
  }
});
