import { defineEventHandler, getRouterParam } from 'h3';

import { knowledgeTree } from '../../../lib/knowledge';
import { fail } from '../../../utils/http';
import { inboxNotes } from '../../../utils/inbox-service';
import { loadIndex } from '../../../utils/index-service';
import { findProject } from '../../../utils/projects';

/** Дерево пространства знаний: проектные документы, решения, контракты и заметки входящего. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  try {
    return { tree: knowledgeTree(loadIndex(project.root).records, inboxNotes(project.root)) };
  } catch (error) {
    return fail(event, 500, 'knowledge_failed', 'Не удалось собрать дерево знаний', String(error));
  }
});
