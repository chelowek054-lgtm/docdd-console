import { readFileSync } from 'node:fs';

import { defineEventHandler, getQuery, getRouterParam } from 'h3';

import { resolveInside } from '../../../lib/paths';
import { buildSearchIndex, searchIndex, type SearchDoc, type SearchIndex } from '../../../lib/search';
import { readWorkspace } from '../../../lib/workspace';
import { fail } from '../../../utils/http';
import { inboxNotes } from '../../../utils/inbox-service';
import { loadIndex } from '../../../utils/index-service';
import { findProject } from '../../../utils/projects';

/** Индекс живёт в памяти процесса и привязан к отпечатку файлов: сменился отпечаток — собрали заново. */
const cache = new Map<string, { fingerprint: string; index: SearchIndex }>();

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  const q = getQuery(event)['q'];
  if (typeof q !== 'string' || q.trim() === '') return { hits: [] };

  try {
    const fingerprint = readWorkspace(project.root).fingerprint;
    let entry = cache.get(project.root);
    if (!entry || entry.fingerprint !== fingerprint) {
      const docs: SearchDoc[] = loadIndex(project.root).records.map((record) => {
        let text = '';
        try { text = readFileSync(resolveInside(project.root, record.path), 'utf8'); } catch { /* файл мог исчезнуть между сборками */ }
        return { id: record.id, title: record.title, path: record.path, type: record.type, text };
      });
      for (const note of inboxNotes(project.root)) docs.push({ id: note.path, title: note.title, path: note.path, type: 'note', text: note.text });
      entry = { fingerprint, index: buildSearchIndex(docs) };
      cache.set(project.root, entry);
    }
    return { hits: searchIndex(entry.index, q) };
  } catch (error) {
    return fail(event, 500, 'search_failed', 'Поиск не удался', String(error));
  }
});
