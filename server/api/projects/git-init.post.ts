import { existsSync } from 'node:fs';

import { defineEventHandler, readBody } from 'h3';

import { normalizeRoot } from '../../lib/paths';
import { fail } from '../../utils/http';
import { initRepository, isRepository } from '../../utils/git';
import { rootAllowed } from '../../utils/mode';

/**
 * `git init -b main` в папке проекта — только с согласия человека (R-0094): тело обязано нести
 * `consent: true`, иначе отказ. Репозиторий уже есть — ничего не делаем. Больше git ничего не меняет:
 * ни коммита, ни удалённого адреса.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ root?: unknown; consent?: unknown }>(event);
  const root = typeof body?.root === 'string' ? body.root.trim() : '';
  if (!root) return fail(event, 400, 'root_required', 'Не указан путь к корню проекта');
  if (body?.consent !== true) return fail(event, 400, 'consent_required', 'Репозиторий заводится только с согласия человека: consent: true');
  const normalized = normalizeRoot(root);
  if (!rootAllowed(normalized)) return fail(event, 403, 'root_not_allowed', 'Путь вне каталогов из DOCDD_PROJECT_ROOTS');
  if (!existsSync(normalized)) return fail(event, 404, 'root_not_found', `Папки \`${normalized}\` не существует`, normalized);
  if (await isRepository(normalized)) return { repo: true, created: false };
  const result = await initRepository(normalized);
  if (!result.ok) return fail(event, 500, 'git_init_failed', 'Не удалось завести репозиторий', result.stderr.trim());
  return { repo: true, created: true };
});
