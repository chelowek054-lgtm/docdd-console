import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { defineEventHandler, readBody } from 'h3';

import { normalizeRoot } from '../../lib/paths';
import { DEFAULT_PATHS, fileNameFor, manifestYaml, recordTemplate } from '../../lib/scaffold';
import type { SectionKey } from '../../lib/types';
import { developmentDir, hasWorkspace, MANIFEST_FILE } from '../../lib/workspace';
import { fail } from '../../utils/http';
import { findProject, saveProject } from '../../utils/projects';
import { today } from '../../utils/record-write';

/**
 * Заведение формата в пустом проекте: манифест, папки разделов и первая
 * запись. Дальше наполняет человек — приложение записей за него не пишет.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ root?: unknown; id?: unknown; name?: unknown }>(event);
  const root = typeof body?.root === 'string' ? body.root.trim() : '';
  const id = typeof body?.id === 'string' ? body.id.trim() : '';
  const name = typeof body?.name === 'string' ? body.name.trim() : '';

  if (!root) return fail(event, 400, 'root_required', 'Не указан путь к корню проекта');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    return fail(
      event,
      400,
      'project_id_invalid',
      'Идентификатор проекта — строчные латинские буквы, цифры и дефис, начиная с буквы или цифры'
    );
  }
  if (!name) return fail(event, 400, 'project_name_required', 'Не указано имя проекта');

  const normalized = normalizeRoot(root);
  if (!existsSync(normalized)) {
    return fail(event, 404, 'root_not_found', `Папки \`${normalized}\` не существует`, normalized);
  }
  if (hasWorkspace(normalized)) {
    // Перезаписать чужой манифест приложение не вправе ни при каких условиях.
    return fail(
      event,
      409,
      'already_initialized',
      `В папке уже есть docs/development/${MANIFEST_FILE} — заводить формат заново нечего`,
      normalized
    );
  }

  const taken = await findProject(id);
  if (taken && taken.root !== normalized) {
    return fail(event, 409, 'project_id_taken', `Проект \`${id}\` уже добавлен из другой папки`, taken.root);
  }

  try {
    const development = developmentDir(normalized);
    mkdirSync(development, { recursive: true });
    for (const folder of Object.values(DEFAULT_PATHS)) {
      mkdirSync(join(development, folder), { recursive: true });
    }

    writeFileSync(join(development, MANIFEST_FILE), manifestYaml({ id, name }), 'utf8');

    // Первая запись — требование: с него начинается всё остальное.
    const first = { id: 'R-0001', type: 'requirement' as const, title: 'Первое требование', today: today() };
    const section: SectionKey = 'requirements';
    writeFileSync(
      join(development, DEFAULT_PATHS[section], fileNameFor(first.id, first.title)),
      recordTemplate(first),
      'utf8'
    );

    const entry = { id, name, root: normalized, lastOpenedAt: new Date().toISOString() };
    await saveProject(entry);
    return entry;
  } catch (error) {
    return fail(event, 500, 'init_failed', 'Не удалось завести формат в папке', String(error));
  }
});
