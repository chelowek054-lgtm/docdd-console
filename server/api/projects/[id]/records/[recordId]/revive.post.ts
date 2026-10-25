import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { defineEventHandler, getRouterParam } from 'h3';

import { dropCache } from '../../../../../lib/cache';
import { targetPath } from '../../../../../lib/import';
import { OutsideRootError, normalizeRoot, resolveInside } from '../../../../../lib/paths';
import { nextId, recordTemplate } from '../../../../../lib/scaffold';
import { DEVELOPMENT_DIR, WorkspaceError } from '../../../../../lib/workspace';
import { fail } from '../../../../../utils/http';
import { loadIndex } from '../../../../../utils/index-service';
import { findProject } from '../../../../../utils/projects';
import { journalNow, openRecord } from '../../../../../utils/record-write';

/**
 * «Перенести в текущий курс» (A-0001, R-0103): черновик нового требования с тем же
 * заголовком и текстом и полем `derived_from`. Прежняя запись не трогается — новая
 * берёт нужное, не реанимируя старую.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const recordId = getRouterParam(event, 'recordId') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);

  try {
    const root = normalizeRoot(project.root);
    const context = openRecord(root, recordId);
    if (!context) return fail(event, 404, 'record_not_found', `Записи \`${recordId}\` в проекте нет`);
    const source = context.record;
    if (source.type !== 'requirement' || source.status !== 'legacy') {
      return fail(event, 400, 'not_legacy_requirement', `${recordId} — не требование прежнего курса: переносить нечего`);
    }

    const newId = nextId('requirement', context.rules.records.map((record) => record.id));
    const relative = targetPath(DEVELOPMENT_DIR, context.workspace.manifest.paths ?? {}, 'requirement', newId, source.title);
    const absolute = resolveInside(root, relative);
    if (existsSync(absolute)) return fail(event, 409, 'record_exists', `По пути \`${relative}\` уже есть файл`);

    const template = recordTemplate({
      id: newId,
      type: 'requirement',
      title: source.title,
      today: journalNow(root),
      derivedFrom: source.id,
      body: revivedBody(source.id, source.body),
      sources: [source.id]
    });
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, template, 'utf8');
    dropCache(root);

    const record = loadIndex(root, true).records.find((item) => item.id === newId);
    return { record, path: relative };
  } catch (error) {
    if (error instanceof OutsideRootError) return fail(event, 403, 'outside_root', error.message, error.requested);
    if (error instanceof WorkspaceError) return fail(event, 422, error.code, error.message, error.detail);
    return fail(event, 500, 'create_failed', 'Не удалось завести черновик', String(error));
  }
});

/** Текст прежней записи без заголовка и журнала — с пометкой, откуда он: дальше его правит человек. */
function revivedBody(sourceId: string, body: string): string {
  const lines = body.split(/\r?\n/);
  const journal = lines.findIndex((line) => /^##\s+Журнал\s*$/.test(line));
  const prose = (journal === -1 ? lines : lines.slice(0, journal)).filter((line, at, all) => !(at === all.findIndex((item) => item.trim() !== '') && /^#\s/.test(line)));
  return [`Перенесено из ${sourceId} (прежний курс): возьмите нужное, остальное уберите.`, '', prose.join('\n').trim()].join('\n').trim();
}
