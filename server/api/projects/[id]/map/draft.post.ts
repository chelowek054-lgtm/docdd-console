import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { analyze } from '../../../../lib/analyze';
import { dropCache } from '../../../../lib/cache';
import { targetPath } from '../../../../lib/import';
import { parseMapRecord, MAP_STRUCTURES, type MapChange } from '../../../../lib/maps';
import { OutsideRootError, normalizeRoot, resolveInside } from '../../../../lib/paths';
import { nextId } from '../../../../lib/scaffold';
import { DEVELOPMENT_DIR, WorkspaceError, readWorkspace } from '../../../../lib/workspace';
import { fail, failWith } from '../../../../utils/http';
import { loadIndex } from '../../../../utils/index-service';
import { findProject } from '../../../../utils/projects';
import { today } from '../../../../utils/record-write';

const LF = String.fromCharCode(10);

/**
 * Ответ модели — черновиком записи типа `map`. Приложение проверяет три
 * структуры по схемам и **не подтверждает** запись: подтверждает человек
 * (docs/adr/0008-llm-through-claude-code.md).
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const body = await readBody<{ answer?: unknown; title?: unknown }>(event);
  const answer = typeof body?.answer === 'string' ? body.answer : '';
  const title = typeof body?.title === 'string' && body.title.trim()
    ? body.title.trim()
    : `Карта от ${today()}`;

  if (!answer.trim()) {
    return fail(event, 400, 'answer_required', 'Пустой ответ сохранять нечего');
  }

  // Разбираем то же самое и тем же кодом, что потом читает экран записи.
  const parsed = parseMapRecord(answer);
  if (parsed.present.length === 0) {
    return fail(
      event,
      422,
      'map_blocks_missing',
      'В ответе нет ни одного блока `docdd-codemap`, `docdd-dataflow` или `docdd-userflow`'
    );
  }
  if (parsed.problems.length > 0) {
    // Писать в проект то, что не разбирается, приложение не станет.
    return failWith(
      event,
      422,
      'map_invalid',
      'Ответ модели не прошёл схемы карт: черновик не создан',
      parsed.problems.map((problem) => ({ code: problem.structure, message: problem.message }))
    );
  }

  try {
    const root = normalizeRoot(project.root);
    const workspace = readWorkspace(root);
    const analysis = analyze({ files: workspace.files, manifest: workspace.manifest });

    const recordId = nextId('map', analysis.records.map((record) => record.id));
    const relative = targetPath(DEVELOPMENT_DIR, workspace.manifest.paths ?? {}, 'map', recordId, title);
    const absolute = resolveInside(root, relative);
    if (existsSync(absolute)) {
      return fail(event, 409, 'record_exists', `По пути \`${relative}\` уже есть файл`);
    }

    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, draftText(recordId, title, parsed.change, parsed.present), 'utf8');
    dropCache(root);

    const index = loadIndex(root, true);
    return {
      record: index.records.find((item) => item.id === recordId),
      path: relative,
      structures: parsed.present
    };
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'draft_failed', 'Не удалось сохранить черновик карты', String(error));
  }
});

/**
 * Тело черновика: только блоки структур и оговорка, откуда они взялись. Текст
 * ответа целиком не сохраняем — в записи должно лежать то, что читается, а не
 * стенограмма разговора.
 */
function draftText(id: string, title: string, change: MapChange, present: readonly string[]): string {
  const lines = [
    '---',
    `id: ${id}`,
    'type: map',
    `title: ${title}`,
    'status: draft',
    `created: ${today()}`,
    `updated: ${today()}`,
    '---',
    '',
    `# ${title}`,
    '',
    'Черновик: составлен моделью, не подтверждён. Прочитайте, поправьте руками',
    'то, что модель не поняла, и подтвердите — до этого карта на общую картину',
    'не влияет.',
    ''
  ];

  for (const structure of MAP_STRUCTURES) {
    if (!present.includes(structure)) continue;
    // Пишем разобранное, а не кусок ответа: так в записи оказывается ровно то,
    // что прошло схему, в одном и том же виде независимо от разметки модели.
    lines.push('```docdd-' + structure, JSON.stringify(change[structure] ?? {}, null, 2), '```', '');
  }

  lines.push('## Журнал', '', `- ${today()} · заведена черновиком · модель`, '');
  return lines.join(LF);
}
