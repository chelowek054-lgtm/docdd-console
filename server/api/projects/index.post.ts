import { defineEventHandler, readBody } from 'h3';

import { normalizeRoot } from '../../lib/paths';
import { WorkspaceError, readManifest } from '../../lib/workspace';
import { fail } from '../../utils/http';
import { findProject, saveProject } from '../../utils/projects';

export default defineEventHandler(async (event) => {
  const body = await readBody<{ root?: unknown }>(event);
  const root = typeof body?.root === 'string' ? body.root.trim() : '';
  if (!root) {
    return fail(event, 400, 'root_required', 'Не указан путь к корню проекта');
  }

  const normalized = normalizeRoot(root);
  try {
    const manifest = readManifest(normalized);
    const id = manifest.project.id;

    // Один идентификатор — один проект: под ним лежат все ссылки в интерфейсе.
    const taken = await findProject(id);
    if (taken && taken.root !== normalized) {
      return fail(
        event,
        409,
        'project_id_taken',
        `Проект с идентификатором \`${id}\` уже добавлен из другой папки`,
        taken.root
      );
    }

    const entry = {
      id,
      name: manifest.project.name,
      root: normalized,
      lastOpenedAt: new Date().toISOString()
    };
    await saveProject(entry);
    return entry;
  } catch (error) {
    if (error instanceof WorkspaceError) {
      const status = error.code === 'project_not_found' ? 404 : 422;
      return fail(event, status, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'read_failed', 'Не удалось прочитать проект', String(error));
  }
});
