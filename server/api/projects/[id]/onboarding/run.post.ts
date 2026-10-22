import { defineEventHandler, getRouterParam, readBody } from 'h3';

import type { StepId } from '../../../../lib/onboarding';
import { fail } from '../../../../utils/http';
import { onboardingReport } from '../../../../utils/onboarding-service';
import { runOnboarding } from '../../../../utils/onboarding-steps';
import { findProject } from '../../../../utils/projects';

const STEP_IDS = ['vision', 'capabilities', 'requirements', 'glossary', 'sources', 'maps', 'contracts', 'references', 'checks'];

/**
 * «Запустить подключение» (R-0075): `{ step?, force? }`. Автоматические шаги выполняются сразу,
 * остальные приходят в `left` со ссылкой на экран. Записи — черновиками, ничего не перетирается.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  const body = (await readBody<{ step?: unknown; force?: unknown }>(event)) ?? {};
  const only = typeof body.step === 'string' ? body.step : '';
  if (only && !STEP_IDS.includes(only)) return fail(event, 400, 'step_unknown', `Шага \`${only}\` в чек-листе нет`);
  const outcome = await runOnboarding(project.root, { force: body.force === true, ...(only ? { only: only as StepId } : {}) });
  return { ...outcome, ...onboardingReport(project.root) };
});
