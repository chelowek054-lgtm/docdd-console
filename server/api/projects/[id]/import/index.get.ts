import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { defineEventHandler, getRouterParam } from 'h3';

import { surveyFile, type SurveyRow } from '../../../../lib/import';
import { OutsideRootError, normalizeRoot, toProjectPath } from '../../../../lib/paths';
import { WorkspaceError, readManifest } from '../../../../lib/workspace';
import { fail } from '../../../../utils/http';
import { findProject } from '../../../../utils/projects';

/** Обзор существующей документации: что нашли в каталогах `sources.docs`. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  try {
    const root = normalizeRoot(project.root);
    const manifest = readManifest(root);
    const folders = manifest.sources?.docs ?? [];

    const rows: SurveyRow[] = [];
    for (const folder of folders) {
      for (const path of walk(join(root, folder))) {
        if (!path.toLowerCase().endsWith('.md')) continue;
        rows.push(surveyFile(toProjectPath(root, path), readFileSync(path, 'utf8')));
      }
    }
    rows.sort((a, b) => a.path.localeCompare(b.path));

    return { folders, rows };
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'read_failed', 'Не удалось осмотреть документацию', String(error));
  }
});

function walk(directory: string): string[] {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) return [];
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...walk(path));
    else if (entry.isFile()) found.push(path);
  }
  return found.sort();
}
