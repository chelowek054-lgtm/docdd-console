import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { parseGlossary } from '../../../../lib/glossary';
import { glossaryText, parseFeatures, parseTerms, wizardPlan } from '../../../../lib/new-project';
import { OutsideRootError, resolveInside } from '../../../../lib/paths';
import { fail } from '../../../../utils/http';
import { createRecords } from '../../../../utils/inbox-service';
import { findProject } from '../../../../utils/projects';

/**
 * Мастер нового проекта (R-0076): `{ vision, features, glossary?, phase? }`, где `features` — строки
 * «Название — требование», `glossary` — строки «Термин — определение». Заводит черновики: карту с вектором и
 * возможностями, на каждую — требование, проверку и задачу, и фазу; пишет `glossary.md`, если его ещё нет.
 * Ничего не подтверждает: это делает человек.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  const body = (await readBody<Record<string, unknown>>(event)) ?? {};
  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  const vision = (body['vision'] ?? {}) as Record<string, unknown>;
  const plan = wizardPlan({
    vision: { problem: text(vision['problem']), audience: text(vision['audience']), outcome: text(vision['outcome']), not: text(vision['not']) },
    features: parseFeatures(text(body['features'])),
    phase: text(body['phase'])
  });
  if (plan.problems.length) return fail(event, 400, 'wizard_incomplete', plan.problems.join(' '));
  try {
    const outcome = createRecords(project.root, plan.records, []);
    if (!outcome.ok) return fail(event, 409, outcome.code, outcome.message);

    // Глоссарий: существующий с терминами не перезаписывается — дописывать в него должен человек.
    const path = resolveInside(project.root, 'docs/development/glossary.md');
    let glossary: 'written' | 'kept' | 'skipped' = 'skipped';
    if (text(body['glossary']).trim() || !existsSync(path)) {
      const had = existsSync(path) && parseGlossary(readFileSync(path, 'utf8')).length > 0;
      if (had) glossary = 'kept';
      else {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, glossaryText(parseTerms(text(body['glossary'])), project.name ?? id), 'utf8');
        glossary = 'written';
      }
    }
    return { created: outcome.created, problems: outcome.problems, glossary };
  } catch (error) {
    if (error instanceof OutsideRootError) return fail(event, 403, 'outside_root', error.message, error.requested);
    return fail(event, 500, 'wizard_failed', 'Не удалось завести записи', String(error));
  }
});
