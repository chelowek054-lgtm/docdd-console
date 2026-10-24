import { existsSync } from 'node:fs';

import { defineEventHandler, getQuery } from 'h3';

import { normalizeRoot } from '../../lib/paths';
import { fail } from '../../utils/http';
import { currentBranch, isRepository } from '../../utils/git';
import { rootAllowed } from '../../utils/mode';

/**
 * Git-репозиторий в папке проекта (R-0094): подключение проверяет его до заведения формата.
 * Ответ — `{ repo, branch }`; папки нет — `404`, путь вне разрешённых корней — `403`.
 */
export default defineEventHandler(async (event) => {
  const root = String(getQuery(event)['root'] ?? '').trim();
  if (!root) return fail(event, 400, 'root_required', 'Не указан путь к корню проекта');
  const normalized = normalizeRoot(root);
  if (!rootAllowed(normalized)) return fail(event, 403, 'root_not_allowed', 'Путь вне каталогов из DOCDD_PROJECT_ROOTS');
  if (!existsSync(normalized)) return fail(event, 404, 'root_not_found', `Папки \`${normalized}\` не существует`, normalized);
  const repo = await isRepository(normalized);
  return { repo, branch: repo ? await currentBranch(normalized) : null };
});
