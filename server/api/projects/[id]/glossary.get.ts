import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { defineEventHandler, getRouterParam } from 'h3';

import { parseGlossary } from '../../../lib/glossary';
import { resolveInside } from '../../../lib/paths';
import { fail } from '../../../utils/http';
import { findProject } from '../../../utils/projects';

/** Термины проекта из `docs/development/glossary.md`; файла нет — пустой список, а не ошибка. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  const path = resolveInside(project.root, join('docs', 'development', 'glossary.md'));
  return { terms: existsSync(path) ? parseGlossary(readFileSync(path, 'utf8')) : [] };
});
